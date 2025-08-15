// script.js — Star Chart interactive (monochrome eye candy, orbit placement, zoom-to-cursor, inner nodes)
// Replaces prior behavior with improved zoom pivot and graceful fallbacks for missing image assets.

// Canvas + resizing
const canvas = document.getElementById('starChart');
const ctx = canvas.getContext('2d', { alpha: true });
let width = 0, height = 0;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Assets (image fallbacks are used)
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

// audio (optional)
const sounds = {
  hover: new Audio('./assets/hover.mp3').catch?.(() => {}),
  zoom: new Audio('./assets/zoom.mp3').catch?.(() => {}),
  background: new Audio('./assets/background.mp3').catch?.(() => {})
};
if (sounds.background && sounds.background.play) {
  sounds.background.loop = true;
  sounds.background.volume = 0.22;
  try { sounds.background.play().catch(()=>{}); } catch(e){}
}

// Try loading achievements.json (expected structure: { planets: [ { planetName, resources[], tiers:[{tierName, achievements:[{title,description,status}] }], junction? } ] })
let achievements = { planets: [] };
fetch('./achievements.json')
  .then(r => r.json())
  .then(j => {
    achievements = j;
    mergeSavedProgress();
    buildSidePanel();
  })
  .catch(err => {
    console.warn('achievements.json not found or failed to parse. Creating demo content.');
    // minimal demo fallback
    achievements = createDemoData();
    mergeSavedProgress();
    buildSidePanel();
  });

function mergeSavedProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('progress') || 'null');
    if (saved && saved.planets) {
      // merge statuses (only statuses preserved)
      saved.planets.forEach((sp, i) => {
        if (!achievements.planets[i]) return;
        sp.tiers?.forEach((st, j) => {
          st.achievements?.forEach((sa, k) => {
            if (achievements.planets[i].tiers?.[j]?.achievements?.[k]) {
              achievements.planets[i].tiers[j].achievements[k].status = sa.status || achievements.planets[i].tiers[j].achievements[k].status;
            }
          });
        });
      });
    }
  } catch(e){}
}

// — Camera & controls —
let camera = { x: 0, y: 0, scale: 0.6 };
let targetCamera = { x: 0, y: 0, scale: 0.6 };
const easing = 0.12;

let focusedCore = null;    // index of selected planet (outer)
let focusedTier = null;    // selected tier index
let hovered = null;        // hover object {type:..., ...}
let isDragging = false;
let startX = 0, startY = 0;
let dragCamX = 0, dragCamY = 0;

// Visual constants
const coreRadius = Math.min(width, height) * 0.22 || 380; // distance planets from center
const planetSize = 70;
const tierRadius = 110;
const tierSize = 40;
const achievementSize = 14;

// starfield
let starParticles = [];
function resetStars(){
  starParticles = [];
  for (let i = 0; i < 220; i++) {
    starParticles.push({
      x: Math.random() * 3000 - 1500,
      y: Math.random() * 2000 - 1000,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.2 + 0.05,
      alpha: Math.random() * 0.7 + 0.2
    });
  }
}
resetStars();
let tTime = 0;

// DOM elements
const hoverInfo = document.getElementById('hoverInfo');
const sidePanel = document.getElementById('sidePanel');
const planetNameEl = document.getElementById('planetName');
const planetMetaEl = document.getElementById('planetMeta');
const tiersSection = document.getElementById('tiersSection');
const tiersList = document.getElementById('tiersList');
const junctionSection = document.getElementById('junctionSection');
const junctionList = document.getElementById('junctionList');
const popup = document.getElementById('popup');
const junctionModal = document.getElementById('junctionModal');
const junctionTasks = document.getElementById('junctionTasks');
const junctionTitle = document.getElementById('junctionTitle');
const junctionClose = document.getElementById('junctionClose');
const junctionComplete = document.getElementById('junctionComplete');

document.getElementById('zoomOutBtn').addEventListener('click', () => {
  targetCamera.scale = 0.6; focusedCore = focusedTier = null; hideSidePanel();
});
document.getElementById('recenterBtn').addEventListener('click', () => {
  targetCamera.x = 0; targetCamera.y = 0;
});
junctionClose.addEventListener('click', () => junctionModal.style.display = 'none');
junctionComplete.addEventListener('click', () => junctionModal.style.display = 'none');

// build side panel skeleton after data loaded
function buildSidePanel(){
  if (!achievements.planets?.length) return;
  sidePanel.style.display = 'flex';
  document.getElementById('sideTitle').innerText = 'Star Chart — Achievements';
}

// ---------------------------------------------------
// ---------------- Rendering ------------------------
// ---------------------------------------------------
function draw() {
  tTime += 0.016;
  // camera easing
  camera.x += (targetCamera.x - camera.x) * easing;
  camera.y += (targetCamera.y - camera.y) * easing;
  camera.scale += (targetCamera.scale - camera.scale) * easing;

  // clear
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // apply subtle grayscale and contrast for monochrome feel
  ctx.filter = 'grayscale(1) contrast(1.05)';

  // center translate
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  // background subtle vignette via fill
  // draw starfield
  ctx.save();
  starParticles.forEach(p => {
    ctx.globalAlpha = p.alpha * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x, p.y, p.size, p.size);
    p.x -= p.speed;
    if (p.x < -1600) p.x = 1600;
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  // orbit guide lines (glowing concentric rings)
  ctx.save();
  const rings = 6;
  for (let r=1; r<=rings; r++){
    ctx.beginPath();
    const rad = (r/(rings+1)) * (coreRadius * 2.2);
    ctx.lineWidth = 1.2 / camera.scale;
    ctx.strokeStyle = `rgba(127,230,255,${0.02 + r*0.01})`;
    ctx.setLineDash([4,6]);
    ctx.arc(0, 0, rad, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // central hub (bigger)
  ctx.save();
  const centerSize = 260; // larger central hub
  // draw soft glow
  ctx.beginPath();
  ctx.fillStyle = 'rgba(127,230,255,0.02)';
  ctx.arc(0,0, centerSize * 0.6, 0, Math.PI*2); ctx.fill();
  // draw center image or fallback
  if (assets.center.complete && assets.center.naturalWidth) {
    ctx.drawImage(assets.center, -centerSize/2, -centerSize/2, centerSize, centerSize);
  } else {
    // fallback shape
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.arc(0,0, centerSize*0.45, 0, Math.PI*2);
    ctx.fill();
    ctx.lineWidth = 2 / camera.scale;
    ctx.strokeStyle = 'rgba(127,230,255,0.18)';
    ctx.stroke();
  }
  ctx.restore();

  // planets (placed evenly on static orbit)
  const planetCount = Math.max(achievements.planets?.length || 0, 0);
  for (let i=0; i<planetCount; i++){
    const angle = i * (2*Math.PI/planetCount) - Math.PI/2;
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;

    // orbit connector line (center -> planet)
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(px, py);
    ctx.lineWidth = 0.9 / camera.scale;
    ctx.strokeStyle = 'rgba(127,230,255,0.04)';
    ctx.stroke();

    // planet glow if hovered or focused
    if (hovered && hovered.type === 'core' && hovered.index === i) {
      ctx.beginPath();
      ctx.arc(px, py, planetSize*0.95 + 14 + Math.sin(tTime*4)*3, 0, Math.PI*2);
      ctx.lineWidth = 4 / camera.scale;
      ctx.strokeStyle = 'rgba(127,230,255,0.14)';
      ctx.stroke();
    }

    // planet sprite
    if (assets.planet.complete && assets.planet.naturalWidth) {
      ctx.drawImage(assets.planet, px - planetSize/2, py - planetSize/2, planetSize, planetSize);
    } else {
      // fallback draw simple sphere
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.arc(px, py, planetSize/2, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 1.2 / camera.scale; ctx.strokeStyle = 'rgba(127,230,255,0.12)'; ctx.stroke();
    }

    // label when zoomed enough
    if (camera.scale > 0.95) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 14px Arial';
      ctx.textAlign = 'center';
      const pObj = achievements.planets[i];
      ctx.fillText(pObj.planetName || `Planet ${i+1}`, px, py + planetSize/2 + 16);
    }

    // tiers (concentric levels around planet)
    const planet = achievements.planets[i];
    if (!planet || !planet.tiers) continue;
    for (let j=0; j<planet.tiers.length; j++){
      const tcount = planet.tiers.length;
      const tangle = j * (2*Math.PI / tcount) + Math.PI/10; // offset so nodes are not colinear
      const tx = px + Math.cos(tangle) * tierRadius;
      const ty = py + Math.sin(tangle) * tierRadius;

      // connector
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.lineWidth = 1.2 / camera.scale;
      ctx.strokeStyle = 'rgba(127,230,255,0.06)';
      ctx.stroke();

      // tier icon (draw)
      if (assets.node.complete && assets.node.naturalWidth) {
        ctx.drawImage(assets.node, tx - tierSize/2, ty - tierSize/2, tierSize, tierSize);
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.arc(tx, ty, tierSize/2, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 1 / camera.scale; ctx.strokeStyle = 'rgba(127,230,255,0.12)'; ctx.stroke();
      }

      // highlight focused
      if (focusedCore === i && focusedTier === j) {
        ctx.beginPath();
        ctx.arc(tx, ty, tierSize + 8, 0, Math.PI*2);
        ctx.lineWidth = 3 / camera.scale;
        ctx.strokeStyle = 'rgba(127,230,255,0.6)';
        ctx.stroke();
      }

      // junction between tiers (a larger node)
      if (j < planet.tiers.length - 1) {
        const jangle = (j + 0.5) * (2*Math.PI / tcount) + Math.PI/10;
        const jx = px + Math.cos(jangle) * (tierRadius + 36);
        const jy = py + Math.sin(jangle) * (tierRadius + 36);
        if (assets.junction.complete && assets.junction.naturalWidth) {
          ctx.drawImage(assets.junction, jx - 12, jy - 12, 24, 24);
        } else {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.arc(jx, jy, 12, 0, Math.PI*2); ctx.fill();
          ctx.lineWidth = 1.4 / camera.scale; ctx.strokeStyle = 'rgba(127,230,255,0.18)'; ctx.stroke();
        }

        // pulse when in focus
        if (focusedCore === i && focusedTier === j) {
          ctx.beginPath();
          ctx.globalAlpha = 0.6 + Math.sin(tTime*4)*0.2;
          ctx.arc(jx, jy, 24, 0, Math.PI*2);
          ctx.lineWidth = 6 / camera.scale;
          ctx.strokeStyle = 'rgba(127,230,255,0.12)';
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // draw achievements / nodes when this tier is focused
      if (focusedCore === i && focusedTier === j) {
        const tier = planet.tiers[j];
        const numAch = Math.max(tier.achievements.length, 1);
        for (let k=0; k<numAch; k++){
          const aangle = k * (2*Math.PI / numAch) + (Math.random()*0.02);
          const ax = tx + Math.cos(aangle) * 52;
          const ay = ty + Math.sin(aangle) * 52;

          // connector
          ctx.beginPath();
          ctx.moveTo(tx, ty); ctx.lineTo(ax, ay);
          ctx.lineWidth = 1 / camera.scale;
          ctx.strokeStyle = 'rgba(127,230,255,0.06)';
          ctx.stroke();

          const ach = tier.achievements[k];

          // visual by state
          if (ach && ach.status === 'available') {
            // pulse image or circle
            if (assets.pulse.complete && assets.pulse.naturalWidth) {
              ctx.drawImage(assets.pulse, ax - 12, ay - 12, 24, 24);
            } else {
              ctx.beginPath();
              ctx.arc(ax, ay, 8, 0, Math.PI*2); ctx.fillStyle = 'rgba(127,230,255,0.14)'; ctx.fill();
              ctx.lineWidth = 1.2 / camera.scale; ctx.strokeStyle = 'rgba(127,230,255,0.22)'; ctx.stroke();
            }
          }

          // node or lock
          if (ach && ach.status === 'locked') {
            if (assets.lock.complete && assets.lock.naturalWidth) {
              ctx.drawImage(assets.lock, ax - achievementSize/2, ay - achievementSize/2, achievementSize, achievementSize);
            } else {
              // draw small lock fallback
              ctx.beginPath();
              ctx.fillStyle = 'rgba(255,255,255,0.06)';
              ctx.rect(ax - 6, ay - 6, 12, 12);
              ctx.fill();
            }
          } else {
            // completed vs normal node
            if (ach && ach.status === 'completed') {
              ctx.beginPath();
              ctx.arc(ax, ay, achievementSize/2, 0, Math.PI*2);
              ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
              ctx.lineWidth = 1 / camera.scale; ctx.strokeStyle = 'rgba(127,230,255,0.28)'; ctx.stroke();
            } else {
              if (assets.node.complete && assets.node.naturalWidth) {
                ctx.drawImage(assets.node, ax - achievementSize/2, ay - achievementSize/2, achievementSize, achievementSize);
              } else {
                ctx.beginPath();
                ctx.arc(ax, ay, achievementSize/2, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
                ctx.lineWidth = 1 / camera.scale; ctx.strokeStyle = 'rgba(127,230,255,0.12)'; ctx.stroke();
              }
            }
          }

          // hover highlight
          if (hovered && hovered.type === 'achievement' && hovered.core === i && hovered.tier === j && hovered.ach === k) {
            ctx.beginPath();
            ctx.arc(ax, ay, 12, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(127,230,255,0.9)';
            ctx.lineWidth = 2 / camera.scale;
            ctx.stroke();
          }
        }
      }

    } // end tiers loop
  } // end planets loop

  // restore transform & reset filter
  ctx.restore();
  ctx.filter = 'none';

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// ---------------- Input / Interaction ----------------

// coordinate helpers: convert screen coords to world coords (taking camera into account)
function screenToWorld(clientX, clientY) {
  const cx = clientX;
  const cy = clientY;
  const worldX = (cx - width/2) / camera.scale - camera.x;
  const worldY = (cy - height/2) / camera.scale - camera.y;
  return { x: worldX, y: worldY };
}

// mouse down / drag
canvas.addEventListener('mousedown', e => {
  isDragging = true;
  startX = e.clientX; startY = e.clientY;
  dragCamX = targetCamera.x; dragCamY = targetCamera.y;
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mouseup', e => {
  canvas.style.cursor = 'grab';
  if (!isDragging) return;
  isDragging = false;
  // if it's a click (near original point), handle click target
  if (Math.hypot(e.clientX - startX, e.clientY - startY) < 6) {
    if (hovered) {
      handleClick(hovered);
    } else {
      // clicked empty space: deselect & zoom out
      focusedCore = null; focusedTier = null;
      targetCamera.scale = 0.6;
      hideSidePanel();
    }
  }
});

canvas.addEventListener('mouseleave', () => {
  isDragging = false;
  canvas.style.cursor = 'default';
  setHovered(null);
});

// mouse move
canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    // panning
    const dx = (e.clientX - startX) / camera.scale;
    const dy = (e.clientY - startY) / camera.scale;
    targetCamera.x = dragCamX + dx;
    targetCamera.y = dragCamY + dy;
    return;
  }
  const world = screenToWorld(e.clientX, e.clientY);
  const newHover = detectHover(world.x, world.y);
  setHovered(newHover);
  hoverInfo.style.left = (e.clientX + 18) + 'px';
  hoverInfo.style.top = (e.clientY + 18) + 'px';
});

// wheel (zoom to cursor)
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const prevScale = targetCamera.scale;
  // delta scaled (make it comfortable)
  const delta = -e.deltaY * 0.0014;
  let newScale = Math.max(0.25, Math.min(6, targetCamera.scale + delta));
  // zoom toward mouse pointer:
  const mx = e.clientX, my = e.clientY;
  // world position before zoom
  const before = screenToWorld(mx, my);
  targetCamera.scale = newScale;
  // apply immediate change for pivot math (we modify targetCamera.x/y so the camera animates to the right place)
  const afterScale = newScale;
  const afterWorldX = (mx - width/2) / afterScale - targetCamera.x;
  const afterWorldY = (my - height/2) / afterScale - targetCamera.y;
  // adjust camera to keep the same world point under cursor
  targetCamera.x += (afterWorldX - before.x);
  targetCamera.y += (afterWorldY - before.y);
  try{ sounds.zoom.play().catch(()=>{}); }catch(e){}
}, { passive: false });

// basic touch support (pan + pinch not implemented fully here)
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    isDragging = true;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dragCamX = targetCamera.x; dragCamY = targetCamera.y;
  }
});
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && isDragging) {
    const dx = (e.touches[0].clientX - startX) / camera.scale;
    const dy = (e.touches[0].clientY - startY) / camera.scale;
    targetCamera.x = dragCamX + dx;
    targetCamera.y = dragCamY + dy;
  }
});
canvas.addEventListener('touchend', e => { isDragging = false; });

// -------------------------------- Hover / Hit detection ------------------------------
function detectHover(mx, my) {
  if (!achievements.planets) return null;
  const planetCount = achievements.planets.length;
  for (let i=0; i<planetCount; i++){
    const angle = i * (2*Math.PI/planetCount) - Math.PI/2;
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;
    if (distance(mx, my, px, py) < planetSize * 0.8) {
      return { type: 'core', index: i };
    }
    const planet = achievements.planets[i];
    for (let j=0; j<(planet.tiers?.length || 0); j++){
      const tcount = planet.tiers.length;
      const tangle = j * (2*Math.PI / tcount) + Math.PI/10;
      const tx = px + Math.cos(tangle) * tierRadius;
      const ty = py + Math.sin(tangle) * tierRadius;
      if (distance(mx, my, tx, ty) < tierSize * 0.8) {
        return { type: 'tier', core: i, tier: j };
      }
      if (focusedCore === i && focusedTier === j) {
        const tier = planet.tiers[j];
        for (let k=0; k<tier.achievements.length; k++){
          const aangle = k * (2*Math.PI / Math.max(1, tier.achievements.length));
          const ax = tx + Math.cos(aangle) * 52;
          const ay = ty + Math.sin(aangle) * 52;
          if (distance(mx, my, ax, ay) < achievementSize * 0.9) {
            return { type: 'achievement', core: i, tier: j, ach: k };
          }
        }
      }
    }
  }
  return null;
}

function setHovered(h) {
  hovered = h;
  if (!h) {
    hoverInfo.classList.remove('show');
    hoverInfo.setAttribute('aria-hidden', 'true');
    return;
  }
  hoverInfo.classList.add('show');
  hoverInfo.setAttribute('aria-hidden', 'false');

  // update hover content
  if (h.type === 'core') {
    const p = achievements.planets[h.index];
    hoverInfo.querySelector('.hi-title').innerText = p.planetName || `Planet ${h.index+1}`;
    let resHtml = '';
    if (p.resources && p.resources.length) {
      resHtml = '<strong>Resources:</strong><br>' + p.resources.slice(0,6).map(r => `• ${r}`).join('<br>');
    } else {
      resHtml = `<em>${p.description || 'No resource data in JSON'}</em>`;
    }
    hoverInfo.querySelector('.hi-resources').innerHTML = resHtml;
    try{ sounds.hover.play().catch(()=>{}); }catch(e){}
  } else if (h.type === 'tier') {
    const p = achievements.planets[h.core];
    const t = p.tiers[h.tier];
    hoverInfo.querySelector('.hi-title').innerText = `${t.tierName || 'Tier ' + (h.tier+1)}`;
    hoverInfo.querySelector('.hi-resources').innerHTML = `${t.achievements.length} achievements • Click to open tier`;
    try{ sounds.hover.play().catch(()=>{}); }catch(e){}
  } else if (h.type === 'achievement') {
    const a = achievements.planets[h.core].tiers[h.tier].achievements[h.ach];
    hoverInfo.querySelector('.hi-title').innerText = a.title || 'Achievement';
    hoverInfo.querySelector('.hi-resources').innerHTML = `${a.description || ''}<br>Status: ${a.status || 'locked'}`;
    try{ sounds.hover.play().catch(()=>{}); }catch(e){}
  }
}

// -------------------------------- Click handling ------------------------------
function handleClick(hit) {
  if (!hit) return;
  if (hit.type === 'core') {
    const i = hit.index;
    const angle = i * (2*Math.PI / achievements.planets.length) - Math.PI/2;
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;
    // focus and zoom in toward planet center
    targetCamera.x = -px;
    targetCamera.y = -py;
    targetCamera.scale = 1.6;
    focusedCore = i; focusedTier = null;
    populateSidePanelForPlanet(i);
    try{ sounds.zoom.play().catch(()=>{}); }catch(e){}
  } else if (hit.type === 'tier') {
    const i = hit.core, j = hit.tier;
    const angle = i * (2*Math.PI / achievements.planets.length) - Math.PI/2;
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;
    const tcount = achievements.planets[i].tiers.length;
    const tangle = j * (2*Math.PI / tcount) + Math.PI/10;
    const tx = px + Math.cos(tangle) * tierRadius;
    const ty = py + Math.sin(tangle) * tierRadius;
    targetCamera.x = -tx;
    targetCamera.y = -ty;
    targetCamera.scale = 3.4;
    focusedCore = i; focusedTier = j;
    populateSidePanelForTier(i, j);
    try{ sounds.zoom.play().catch(()=>{}); }catch(e){}
  } else if (hit.type === 'achievement') {
    const { core, tier, ach } = hit;
    showAchievementPopup(core, tier, ach);
  }
}

// show achievement popup
function showAchievementPopup(core, tier, k) {
  const a = achievements.planets[core].tiers[tier].achievements[k];
  const content = document.createElement('div');
  content.innerHTML = `<h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.description || '')}</p>
    <div style="margin-top:8px;">
      <strong>Status:</strong> ${escapeHtml(a.status || 'locked')}
    </div>
    <div style="margin-top:12px; text-align:right;">
      ${a.status !== 'completed' ? `<button id="compBtn">Complete</button>` : ''}
      <button id="closeBtn">Close</button>
    </div>`;
  popup.innerHTML = '';
  popup.appendChild(content);
  popup.style.display = 'block';

  document.getElementById('closeBtn').addEventListener('click', () => popup.style.display = 'none');
  const compBtn = document.getElementById('compBtn');
  if (compBtn) {
    compBtn.addEventListener('click', () => {
      completeAchievement(core, tier, k);
      popup.style.display = 'none';
      populateSidePanelForTier(core, tier);
    });
  }
}

// populate side panel when selecting a planet
function populateSidePanelForPlanet(i) {
  const p = achievements.planets[i];
  if (!p) return;
  document.getElementById('planetName').innerText = p.planetName || `Planet ${i+1}`;
  planetMetaEl.innerText = `Tiers: ${p.tiers.length} • Achievements: ${p.tiers.reduce((s,t)=>s+t.achievements.length,0)}`;
  document.getElementById('planetSummary').classList.remove('hidden');
  tiersSection.classList.remove('hidden');
  junctionSection.classList.remove('hidden');
  // fill tiers list
  tiersList.innerHTML = '';
  p.tiers.forEach((t, j) => {
    const card = document.createElement('div'); card.className = 'tier-card';
    const meta = document.createElement('div'); meta.className = 'tier-meta';
    meta.innerHTML = `<div class="tier-title">${t.tierName || 'Tier ' + (j+1)}</div>
      <div class="tier-desc">${t.achievements.length} achievements</div>`;
    const achWrap = document.createElement('div'); achWrap.className = 'tier-achievements';
    t.achievements.forEach((a,k) => {
      const pill = document.createElement('div'); pill.className = 'ach-pill';
      pill.innerText = `${a.title} [${a.status}]`;
      pill.setAttribute('role','button');
      pill.onclick = () => { focusedCore = i; focusedTier = j; populateSidePanelForTier(i, j); targetCamera.scale = Math.max(targetCamera.scale, 2.2); };
      achWrap.appendChild(pill);
    });
    const btnCol = document.createElement('div');
    btnCol.style.display = 'flex'; btnCol.style.gap='6px';
    const openBtn = document.createElement('button');
    openBtn.innerText = 'Open';
    openBtn.onclick = () => { focusedCore = i; focusedTier = j; populateSidePanelForTier(i, j); targetCamera.scale = 3.6; };
    btnCol.appendChild(openBtn);
    card.appendChild(meta);
    card.appendChild(achWrap);
    card.appendChild(btnCol);
    tiersList.appendChild(card);
  });

  // junctions
  junctionList.innerHTML = '';
  if (p.junction && p.junction.tasks && p.junction.tasks.length) {
    p.junction.tasks.forEach(t => {
      const node = document.createElement('div'); node.className = 'junction-task';
      node.innerText = t;
      junctionList.appendChild(node);
    });
  } else {
    const fallback = document.createElement('div'); fallback.className = 'junction-task';
    fallback.innerHTML = `<strong>Junction tasks will appear here</strong><div style="color:var(--muted); margin-top:6px;">If JSON doesn't include junction tasks, view individual tier achievements to see what is required to progress.</div>`;
    junctionList.appendChild(fallback);
  }
}

// populate side panel for a specific tier
function populateSidePanelForTier(coreIndex, tierIndex) {
  const p = achievements.planets[coreIndex];
  if (!p) return;
  const t = p.tiers[tierIndex];
  document.getElementById('planetName').innerText = `${p.planetName} — ${t.tierName}`;
  planetMetaEl.innerText = `${t.achievements.length} achievements • Tier ${tierIndex+1}`;
  // show achievements
  tiersList.innerHTML = '';
  const card = document.createElement('div'); card.className = 'tier-card';
  const meta = document.createElement('div'); meta.className = 'tier-meta';
  meta.innerHTML = `<div class="tier-title">${t.tierName}</div><div class="tier-desc">${t.achievements.length} achievements</div>`;
  card.appendChild(meta);
  const achWrap = document.createElement('div'); achWrap.className = 'tier-achievements';
  t.achievements.forEach((a,k) => {
    const pill = document.createElement('div'); pill.className = 'ach-pill';
    pill.innerText = `${a.title}`;
    pill.onclick = () => { showAchievementPopup(coreIndex, tierIndex, k); };
    achWrap.appendChild(pill);
  });
  card.appendChild(achWrap);
  tiersList.appendChild(card);

  // junction section
  junctionList.innerHTML = '';
  if (t.junctionTasks && t.junctionTasks.length) {
    junctionTitle.innerText = `${p.planetName} — ${t.tierName} Junction`;
    t.junctionTasks.forEach(task => {
      const node = document.createElement('div'); node.className = 'junction-task';
      node.innerText = task;
      junctionList.appendChild(node);
    });
  } else {
    junctionTitle.innerText = `${p.planetName} — Tier ${tierIndex+1} Hints`;
    t.achievements.slice(0,4).forEach(a => {
      const node = document.createElement('div'); node.className = 'junction-task';
      node.innerHTML = `<strong>${a.title}</strong><div style="color:var(--muted); font-size:13px;">${a.description || ''}</div>`;
      junctionList.appendChild(node);
    });
    const openModalBtn = document.createElement('button');
    openModalBtn.innerText = 'Open Junction Modal';
    openModalBtn.onclick = () => {
      showJunctionModal(p.planetName, t);
    };
    junctionList.appendChild(openModalBtn);
  }
}

function showJunctionModal(planetName, tierObj) {
  junctionModal.style.display = 'flex';
  junctionTitle.innerText = `${planetName} — Junction`;
  junctionTasks.innerHTML = '';
  if (tierObj.achievements && tierObj.achievements.length) {
    tierObj.achievements.forEach((a, idx) => {
      const div = document.createElement('div');
      div.className = 'junction-task';
      div.innerHTML = `<strong>${a.title}</strong><div style="color:var(--muted)">${a.description || ''}</div>`;
      junctionTasks.appendChild(div);
    });
  } else {
    junctionTasks.innerHTML = '<div class="junction-task">No explicit tasks found.</div>';
  }
}

// utility distance
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

// complete achievement
window.completeAchievement = (core, tier, ach) => {
  const a = achievements.planets[core].tiers[tier].achievements[ach];
  if (!a) return;
  a.status = 'completed';
  a.dateCompleted = new Date().toISOString();
  localStorage.setItem('progress', JSON.stringify(achievements));
  // unlock next tier if needed
  const allCompleted = achievements.planets[core].tiers[tier].achievements.every(x => x.status === 'completed');
  if (allCompleted && tier < achievements.planets[core].tiers.length - 1) {
    achievements.planets[core].tiers[tier + 1].achievements.forEach(x => {
      if (x.status === 'locked') x.status = 'available';
    });
  }
  populateSidePanelForTier(core, tier);
};

// Admin UI helpers (kept minimal)
const adminPanel = document.getElementById('adminPanel');
const editContent = document.getElementById('editContent');

window.showAdminPanel = () => { adminPanel.style.display = 'block'; };
window.closeAdmin = () => { adminPanel.style.display = 'none'; editContent.style.display = 'none'; };

window.loginAdmin = () => {
  if (document.getElementById('adminPassword').value === 'admin') {
    let html = '';
    achievements.planets.forEach((p, i) => {
      html += `<h3 style="margin-top:6px;">${p.planetName}</h3>`;
      p.tiers.forEach((t, j) => {
        html += `<h4>${t.tierName}</h4>`;
        t.achievements.forEach((a, k) => {
          html += `<label style="display:flex; gap:8px; align-items:center;">
            <input style="flex:1" type="text" value="${escapeHtml(a.title)}" onchange="editTitle(${i},${j},${k},this.value)" />
            <input style="flex:2" type="text" value="${escapeHtml(a.description||'')}" onchange="editDesc(${i},${j},${k},this.value)" />
            <select onchange="editStatus(${i},${j},${k},this.value)">
              <option${a.status==='locked'?' selected':''}>locked</option>
              <option${a.status==='available'?' selected':''}>available</option>
              <option${a.status==='completed'?' selected':''}>completed</option>
            </select>
          </label>`;
        });
      });
    });
    html += `<div style="margin-top:12px;"><button onclick="downloadJson()">Download JSON</button>
      <button onclick="bulkUnlock()">Bulk Unlock</button>
      <button onclick="bulkReset()">Bulk Reset</button></div>`;
    editContent.innerHTML = html;
    editContent.style.display = 'block';
    document.getElementById('adminPassword').style.display = 'none';
  } else {
    alert('Wrong password');
  }
};

function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
window.editTitle = (i,j,k,value) => { achievements.planets[i].tiers[j].achievements[k].title = value; };
window.editDesc = (i,j,k,value) => { achievements.planets[i].tiers[j].achievements[k].description = value; };
window.editStatus = (i,j,k,value) => {
  const a = achievements.planets[i].tiers[j].achievements[k];
  a.status = value;
  a.dateCompleted = value === 'completed' ? new Date().toISOString() : null;
};
window.downloadJson = () => {
  const blob = new Blob([JSON.stringify(achievements, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'achievements.json'; a.click();
};
window.bulkUnlock = () => { achievements.planets.forEach(p => p.tiers.forEach(t => t.achievements.forEach(a => a.status = 'available'))); alert('All unlocked'); };
window.bulkReset = () => {
  achievements.planets.forEach(p => p.tiers.forEach((t,j) => t.achievements.forEach(a => {
    a.status = j === 0 ? 'available' : 'locked';
    a.dateCompleted = null;
  })));
  alert('All reset');
};

// helpers
function hideSidePanel(){ document.getElementById('planetSummary').classList.add('hidden'); tiersSection.classList.add('hidden'); junctionSection.classList.add('hidden'); }
function showSidePanel(){ document.getElementById('planetSummary').classList.remove('hidden'); tiersSection.classList.remove('hidden'); junctionSection.classList.remove('hidden'); }

// small demo data used if achievements.json can't be read
function createDemoData(){
  return {
    planets: [
      {
        planetName: 'AETHER',
        description: 'Outer deep field',
        resources: ['Alloy', 'Crystal'],
        tiers: [
          { tierName:'Level I', achievements: [ {title:'Scout', description:'Find the relay', status:'available'}, {title:'Clear', description:'Complete a mission', status:'locked'} ] },
          { tierName:'Level II', achievements: [ {title:'Secure', description:'Secure the zone', status:'locked'}, {title:'Relay', description:'Activate relay', status:'locked'} ] }
        ]
      },
      {
        planetName: 'NOVA',
        description: 'Inner core planet',
        resources: ['Gas', 'Ore'],
        tiers: [
          { tierName:'Alpha', achievements: [ {title:'Strike', description:'Eliminate the unit', status:'available'}, {title:'Hack', description:'Override controls', status:'locked'} ] },
          { tierName:'Beta', achievements: [ {title:'Gate', description:'Open gate', status:'locked'} ] }
        ]
      },
      {
        planetName: 'TESSA',
        description: 'Ringed world',
        resources: ['Silica','Polymer'],
        tiers: [
          { tierName:'I', achievements: [ {title:'Survey', description:'Map the nodes', status:'available'} ] }
        ]
      }
    ]
  };
}

// utility to keep local progress
function saveProgress() { try { localStorage.setItem('progress', JSON.stringify(achievements)); } catch(e){} }

// very small safety: ensure at least one planet available
if (!achievements.planets || !achievements.planets.length) achievements = createDemoData();
