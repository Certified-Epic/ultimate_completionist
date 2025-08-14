// Updated script.js
// - Planets arranged on clean orbital radii (no spinning).
// - Central image bigger.
// - Mouse wheel zooms toward cursor (so you can zoom into a planet).
// - Fixed panning calculation and click-vs-drag detection.
// - Clicking outside sidePanel/overlay closes them safely.
// - Does NOT change achievements.json or images.

const canvas = document.getElementById('starChart');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  // Keep 1:1 pixel scaling for simplicity (feel free to add DPR support if desired)
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// Colors (monochrome / can be adjusted)
const colors = {
  background: '#020308',
  stars: '#ffffff',
  line: '#ffffff',
  text: '#ffffff',
  glow: '#ffffff',
  pulse: 'rgba(255,255,255,0.5)',
  ring: '#ffffff'
};

// Assets (images) -- keep these paths as-is
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
  zoom: new Audio('./assets/zoom.mp3'),
  background: new Audio('./assets/background.mp3')
};
try {
  sounds.background.loop = true;
  sounds.background.volume = 0.35;
  // autoplay may be blocked until user interaction
  sounds.background.play().catch(() => {});
} catch (e) {}

// Achievements data (do not edit JSON file)
let achievements = {};
fetch('./achievements.json')
  .then(r => r.json())
  .then(data => {
    achievements = data;
    // merge saved progress into loaded JSON
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
      } catch (e) {
        console.warn('Failed to apply saved progress:', e);
      }
    }

    // Precompute orbit radii and static angles for planets so layout is stable
    computeOrbitLayout();
  })
  .catch(err => console.error('Failed to load achievements.json', err));

// Camera
let camera = { x: 0, y: 0, scale: 0.6 };
let targetCamera = { x: 0, y: 0, scale: 0.6 };
const easing = 0.12;

// Interaction state
let isDragging = false;
let dragStartScreen = { x: 0, y: 0 };
let dragStartCamera = { x: 0, y: 0 };
let lastPointerPos = { x: 0, y: 0 };
let movedSinceDown = 0;
const CLICK_SLOP = 6; // pixels

// Layout & visuals
const centralSize = 200;      // central hub size (in px)
const baseCoreRadius = 300;   // smallest orbit radius
const orbitStep = 120;        // additional radius between planet orbits
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

// Orbit layout storage
const planetLayout = []; // will hold { orbitRadius, angle, px, py } per planet

function computeOrbitLayout() {
  planetLayout.length = 0;
  const planets = achievements.planets || [];
  const count = planets.length || 6;
  // We'll spread planets around with different orbit radii in a pleasing order:
  // alternate inner/outer radii for variety while remaining stable.
  for (let i = 0; i < count; i++) {
    // compute orbit radius = baseCoreRadius + floor(i/2)*orbitStep but alternate sides
    const layer = Math.floor(i / 2);
    const orbitRadius = baseCoreRadius + layer * orbitStep;
    // To avoid same-angle overlap, pick angle evenly around circle
    const angle = (i / count) * (Math.PI * 2) - Math.PI / 2;
    const px = Math.cos(angle) * orbitRadius;
    const py = Math.sin(angle) * orbitRadius;
    planetLayout.push({ orbitRadius, angle, px, py });
  }
}

// Utility: convert screen coordinates -> world coordinates (in canvas space)
function screenToWorld(sx, sy) {
  // Account for canvas center transform and camera transforms
  const wx = (sx - width / 2) / camera.scale - camera.x;
  const wy = (sy - height / 2) / camera.scale - camera.y;
  return { x: wx, y: wy };
}

// Utility: convert world -> screen
function worldToScreen(wx, wy) {
  const sx = (wx + camera.x) * camera.scale + width / 2;
  const sy = (wy + camera.y) * camera.scale + height / 2;
  return { x: sx, y: sy };
}

// Main render loop
function draw() {
  time += 0.016;
  // Smooth camera to target
  camera.x += (targetCamera.x - camera.x) * easing;
  camera.y += (targetCamera.y - camera.y) * easing;
  camera.scale += (targetCamera.scale - camera.scale) * easing;

  // background
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  // save & apply camera transform: translate to center then camera
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  // starfield (parallax-like subtle motion)
  for (let s of starParticles) {
    ctx.globalAlpha = s.alpha * 0.9;
    ctx.fillStyle = colors.stars;
    ctx.fillRect(s.x, s.y, s.size, s.size);
    // move slightly for dynamism (not full rotation)
    s.x -= s.speed * 0.3;
    if (s.x < -2000) s.x = 2000;
  }
  ctx.globalAlpha = 1;

  // central hub bigger and prominent
  ctx.save();
  ctx.drawImage(assets.center, -centralSize / 2, -centralSize / 2, centralSize, centralSize);
  ctx.restore();

  // draw orbit rings and planets
  const planets = achievements.planets || [];
  // draw orbit rings first (so planets on top)
  for (let i = 0; i < planets.length; i++) {
    const L = planetLayout[i];
    if (!L) continue;
    // pulsing orbit ring
    const pulse = 0.08 + 0.06 * Math.sin(time * 1.6 + i);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + pulse})`;
    ctx.lineWidth = Math.max(1, (1.2 + pulse * 2.4) / camera.scale);
    ctx.setLineDash([8 / camera.scale, 10 / camera.scale]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.arc(0, 0, L.orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
  }

  // planets, tiers and achievements (drawn per planet)
  for (let i = 0; i < planets.length; i++) {
    const planet = planets[i];
    const L = planetLayout[i];
    if (!L) continue;
    // planet position
    const px = L.px;
    const py = L.py;

    // planet icon (grayscale by assets)
    ctx.save();
    ctx.drawImage(assets.planet, px - planetSize / 2, py - planetSize / 2, planetSize, planetSize);
    ctx.restore();

    // label shown when zoomed sufficiently
    if (camera.scale > 0.9) {
      ctx.fillStyle = colors.text;
      ctx.font = '600 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(planet.planetName || `Planet ${i + 1}`, px, py + planetSize / 2 + 14);
    }

    // tiers: compute positions around each planet with light scatter
    const tiers = planet.tiers || [];
    for (let j = 0; j < tiers.length; j++) {
      const tier = tiers[j];
      // pick an angle distributed around planet plus small deterministic jitter
      const baseAngle = (j / Math.max(1, tiers.length)) * Math.PI * 2;
      // deterministic jitter to avoid overlapping (stable between runs)
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

      // draw junction marker if applicable (slightly offset, uses same scatter)
      if (j < tiers.length - 1) {
        const jx = px + Math.cos(baseAngle + 0.5) * (dist + 26);
        const jy = py + Math.sin(baseAngle + 0.5) * (dist + 26);
        ctx.drawImage(assets.junction, jx - 8, jy - 8, 16, 16);

        // subtle halo
        const halo = 0.06 + 0.05 * Math.sin(time * 2 + i + j);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${halo})`;
        ctx.lineWidth = 10 / Math.max(0.2, camera.scale);
        ctx.arc(jx, jy, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // If this planet+tier is focused, draw achievement nodes scattered more widely
      if (focusedPlanet === i && focusedTier === j) {
        const aList = tier.achievements || [];
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

          // blinking pulse for available nodes using pulse.png
          if (ach.status === 'available') {
            const phase = Math.sin(time * 4 + k);
            const pulseAlpha = 0.45 + 0.45 * phase; // 0..0.9
            const pulseSize = achievementSize + 8 * (0.6 + 0.4 * phase);
            ctx.save();
            ctx.globalAlpha = pulseAlpha;
            ctx.drawImage(assets.pulse, ax - pulseSize / 2, ay - pulseSize / 2, pulseSize, pulseSize);
            ctx.restore();
          }

          // node icon or lock
          if (ach.status === 'locked') {
            ctx.drawImage(assets.lock, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
          } else {
            ctx.drawImage(assets.node, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
          }

          // hover ring highlight (handled in hit detection set)
          if (hovered && hovered.type === 'achievement' && hovered.core === i && hovered.tier === j && hovered.ach === k) {
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

  // schedule next frame
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// deterministic noise helper (stable small pseudo-random per indices)
function deterministicNoise(a, b, c = 0) {
  // returns value in [-1,1]
  const val = Math.sin(a * 127.1 + b * 311.7 + c * 19.5) * 43758.5453;
  return (val - Math.floor(val)) * 2 - 1;
}

// Hit detection (planet, tier, junction, achievement)
function detectHit(worldX, worldY) {
  const planets = achievements.planets || [];
  for (let i = 0; i < planets.length; i++) {
    const L = planetLayout[i];
    if (!L) continue;
    const px = L.px;
    const py = L.py;
    // planet core hit
    if (distance(worldX, worldY, px, py) < planetSize * 0.6) {
      return { type: 'planet', index: i, px, py };
    }
    const tiers = planets[i].tiers || [];
    for (let j = 0; j < tiers.length; j++) {
      const baseAngle = (j / Math.max(1, tiers.length)) * Math.PI * 2;
      const jitterA = deterministicNoise(i, j, 1) * 0.6;
      const tangle = baseAngle + jitterA;
      const dist = 110 + deterministicNoise(i, j, 2) * 20;
      const tx = px + Math.cos(tangle) * dist;
      const ty = py + Math.sin(tangle) * dist;
      // tier hit
      if (distance(worldX, worldY, tx, ty) < tierSize * 0.7) {
        return { type: 'tier', core: i, tier: j, tx, ty };
      }
      // junction hit (check marker near tier edge)
      if (j < tiers.length - 1) {
        const jx = px + Math.cos(baseAngle + 0.5) * (dist + 26);
        const jy = py + Math.sin(baseAngle + 0.5) * (dist + 26);
        if (distance(worldX, worldY, jx, jy) < 12) {
          return { type: 'junction', core: i, tier: j, jx, jy };
        }
      }
      // achievement nodes (only detect when tier is focused)
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

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Interaction handlers: panning, clicking & hovering

// track last hovered to reduce sound spam
let lastHoverKey = null;
let hovered = null;

// Pointer down (mouse)
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartScreen = { x: e.clientX, y: e.clientY };
  dragStartCamera = { x: targetCamera.x, y: targetCamera.y };
  movedSinceDown = 0;
  lastPointerPos = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = 'grabbing';
});

// Pointer move
canvas.addEventListener('mousemove', (e) => {
  lastPointerPos = { x: e.clientX, y: e.clientY };
  if (isDragging) {
    // compute delta in screen space, convert to world coords by dividing by scale
    const dx = (e.clientX - dragStartScreen.x) / camera.scale;
    const dy = (e.clientY - dragStartScreen.y) / camera.scale;
    targetCamera.x = dragStartCamera.x + dx;
    targetCamera.y = dragStartCamera.y + dy;
    movedSinceDown += Math.abs(e.movementX || e.clientX - dragStartScreen.x) + Math.abs(e.movementY || e.clientY - dragStartScreen.y);
    // while dragging, update hovered to null to avoid accidental clicks
    setHover(null, e.clientX, e.clientY);
    return;
  }

  // not dragging -> hover detection
  const world = screenToWorld(e.clientX, e.clientY);
  const hit = detectHit(world.x, world.y);
  if (hit) {
    // craft hover key string to deduplicate sound
    const key = hit.type + ':' + (hit.index ?? hit.core ?? '') + ':' + (hit.tier ?? '') + ':' + (hit.ach ?? '');
    if (key !== lastHoverKey) {
      try { sounds.hover.play().catch(()=>{}); } catch(e){}
      lastHoverKey = key;
    }
    setHover(hit, e.clientX, e.clientY);
  } else {
    lastHoverKey = null;
    setHover(null, e.clientX, e.clientY);
  }
});

// Pointer up (mouse)
canvas.addEventListener('mouseup', (e) => {
  canvas.style.cursor = 'grab';
  // detect click if not moved significantly
  const totalMove = Math.hypot(e.clientX - dragStartScreen.x, e.clientY - dragStartScreen.y);
  isDragging = false;
  if (totalMove < CLICK_SLOP) {
    // treat as click
    const world = screenToWorld(e.clientX, e.clientY);
    const hit = detectHit(world.x, world.y);
    handleClick(hit, e.clientX, e.clientY);
  }
});

// Wheel zoom that zooms toward cursor
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // current world coordinate under cursor
  const mouseX = e.clientX, mouseY = e.clientY;
  const before = screenToWorld(mouseX, mouseY);

  // zoom factor
  const delta = -e.deltaY * 0.0016; // tweak sensitivity here
  const newScale = Math.max(0.18, Math.min(6, targetCamera.scale + delta));

  // adjust camera.x/y so that the world point stays under the cursor after zoom
  // formula derived from mapping screen->world
  const scaleRatio = newScale / targetCamera.scale;
  targetCamera.scale = newScale;

  // camera after zoom should satisfy:
  // screenX = (worldX + newCamX) * newScale + width/2
  // solve for newCamX => newCamX = (screenX - width/2)/newScale - worldX
  // but we want the same world point 'before' to remain under cursor, so compute new camera accordingly:
  const afterCamX = (mouseX - width / 2) / newScale - before.x;
  const afterCamY = (mouseY - height / 2) / newScale - before.y;

  // set targetCamera to those values to smoothly move camera to that zoom center
  targetCamera.x = afterCamX;
  targetCamera.y = afterCamY;

  try { sounds.zoom.play().catch(()=>{}); } catch (err) {}
}, { passive: false });

// Touch support (pan + pinch)
let pinchStartDist = 0;
let pinchStartScale = 0;

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    isDragging = true;
    dragStartScreen = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragStartCamera = { x: targetCamera.x, y: targetCamera.y };
    movedSinceDown = 0;
  } else if (e.touches.length === 2) {
    pinchStartDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    pinchStartScale = targetCamera.scale;
  }
});
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && isDragging) {
    const dx = (e.touches[0].clientX - dragStartScreen.x) / camera.scale;
    const dy = (e.touches[0].clientY - dragStartScreen.y) / camera.scale;
    targetCamera.x = dragStartCamera.x + dx;
    targetCamera.y = dragStartCamera.y + dy;
  } else if (e.touches.length === 2) {
    const newDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = newDist / Math.max(1, pinchStartDist);
    targetCamera.scale = Math.max(0.18, Math.min(6, pinchStartScale * factor));
  }
});
canvas.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) isDragging = false;
});

// Hover card DOM (existing in index)
const hoverInfo = document.getElementById('hoverInfo');
function setHover(hit, screenX = 0, screenY = 0) {
  hovered = hit;
  if (!hit) {
    hoverInfo.classList.remove('show');
    hoverInfo.setAttribute('aria-hidden', 'true');
    return;
  }
  hoverInfo.style.left = (screenX + 14) + 'px';
  hoverInfo.style.top = (screenY + 14) + 'px';
  hoverInfo.classList.add('show');
  hoverInfo.setAttribute('aria-hidden', 'false');

  // populate fields (hi-title, hi-desc, hi-status expected in HTML)
  if (hit.type === 'planet') {
    const p = achievements.planets[hit.index];
    hoverInfo.querySelector('.hi-title').innerText = p.planetName || `Planet ${hit.index + 1}`;
    const res = (p.resources && p.resources.length) ? p.resources.slice(0, 6).join(', ') : 'No resource data';
    hoverInfo.querySelector('.hi-desc').innerText = `Resources: ${res}`;
    hoverInfo.querySelector('.hi-status').innerText = `${p.tiers.length} locations`;
  } else if (hit.type === 'tier') {
    const t = achievements.planets[hit.core].tiers[hit.tier];
    hoverInfo.querySelector('.hi-title').innerText = t.tierName || `Tier ${hit.tier + 1}`;
    hoverInfo.querySelector('.hi-desc').innerText = `${t.achievements.length} missions`;
    hoverInfo.querySelector('.hi-status').innerText = `Click to open`;
  } else if (hit.type === 'achievement') {
    const a = achievements.planets[hit.core].tiers[hit.tier].achievements[hit.ach];
    hoverInfo.querySelector('.hi-title').innerText = a.title;
    hoverInfo.querySelector('.hi-desc').innerText = a.description || '';
    hoverInfo.querySelector('.hi-status').innerText = `Status: ${a.status || 'locked'}`;
  } else if (hit.type === 'junction') {
    const t = achievements.planets[hit.core].tiers[hit.tier];
    hoverInfo.querySelector('.hi-title').innerText = `${t.tierName} - Junction`;
    hoverInfo.querySelector('.hi-desc').innerText = 'Open junction tasks';
    hoverInfo.querySelector('.hi-status').innerText = '';
  }
}

// Click handler (when not dragging)
function handleClick(hit, screenX = 0, screenY = 0) {
  if (!hit) {
    // clicked empty space: close overlays/panels
    safeHideSidePanel();
    return;
  }

  if (hit.type === 'planet') {
    // focus planet: center camera on planet orbit area and open overlay
    focusedPlanet = hit.index;
    focusedTier = null;
    const angle = planetLayout[hit.index].angle;
    const px = Math.cos(angle) * planetLayout[hit.index].orbitRadius;
    const py = Math.sin(angle) * planetLayout[hit.index].orbitRadius;
    // zoom to show planet & its tiers
    targetCamera.x = -px * 0.38;
    targetCamera.y = -py * 0.38;
    targetCamera.scale = Math.max(targetCamera.scale, 1.2);
    // fill side panel / overlay if present
    showPlanetOverlay(hit.index);
    try { sounds.zoom.play().catch(()=>{}); } catch(e) {}
  } else if (hit.type === 'tier') {
    // focus tier: zoom closely to tier location and expose nodes
    focusedPlanet = hit.core;
    focusedTier = hit.tier;
    // compute exact tx, ty same as in layout logic
    const pL = planetLayout[hit.core];
    const tiers = achievements.planets[hit.core].tiers || [];
    const j = hit.tier;
    const baseAngle = (j / Math.max(1, tiers.length)) * Math.PI * 2;
    const jitterA = deterministicNoise(hit.core, j, 1) * 0.6;
    const tangle = baseAngle + jitterA;
    const dist = 110 + deterministicNoise(hit.core, j, 2) * 20;
    const tx = pL.px + Math.cos(tangle) * dist;
    const ty = pL.py + Math.sin(tangle) * dist;
    targetCamera.x = -tx;
    targetCamera.y = -ty;
    targetCamera.scale = 3.6;
    try { sounds.zoom.play().catch(()=>{}); } catch(e) {}
    // optional: open overlay showing tier achievements (if you have it)
    showPlanetOverlay(hit.core, hit.tier);
  } else if (hit.type === 'achievement') {
    // show a concise popup/briefing (there's #popup in the page)
    const a = achievements.planets[hit.core].tiers[hit.tier].achievements[hit.ach];
    showAchievementPopup(hit.core, hit.tier, hit.ach);
  } else if (hit.type === 'junction') {
    // open sidePanel / junction UI if present
    openJunction(hit.core, hit.tier);
  }
}

// UI helper: safe hide side panel / overlay if present in DOM
function safeHideSidePanel() {
  const panel = document.getElementById('sidePanel');
  if (panel) {
    // check existence and safe hide
    try { panel.style.display = 'none'; } catch (e) {}
  }
  const overlay = document.getElementById('planetOverlay');
  if (overlay) {
    try { overlay.style.display = 'none'; } catch (e) {}
  }
  const junction = document.getElementById('junctionModal');
  if (junction) {
    try { junction.style.display = 'none'; } catch (e) {}
  }
  // also close popup
  const ap = document.getElementById('achievementPopup');
  if (ap) ap.style.display = 'none';
}

// Achievement popup helper (uses #popup or #achievementPopup if present)
function showAchievementPopup(core, tier, ach) {
  const a = achievements.planets[core].tiers[tier].achievements[ach];
  const popup = document.getElementById('popup') || document.getElementById('achievementPopup');
  if (!popup) {
    alert(`${a.title}\n\n${a.description}\n\nStatus: ${a.status}`);
    return;
  }
  popup.innerHTML = '';
  const div = document.createElement('div');
  div.innerHTML = `<h3 style="margin:0 0 8px 0;">${escapeHtml(a.title)}</h3>
      <div style="color:rgba(255,255,255,0.8)">${escapeHtml(a.description || '')}</div>
      <div style="margin-top:12px; text-align:right;">
        ${a.status !== 'completed' ? '<button id="btnComplete">Complete</button>' : ''}
        <button id="btnClose">Close</button>
      </div>`;
  popup.appendChild(div);
  popup.style.display = 'block';
  const closeBtn = popup.querySelector('#btnClose');
  if (closeBtn) closeBtn.addEventListener('click', () => popup.style.display = 'none');
  const completeBtn = popup.querySelector('#btnComplete');
  if (completeBtn) completeBtn.addEventListener('click', () => {
    completeAchievement(core, tier, ach);
    popup.style.display = 'none';
  });
}

// Show planet overlay if present in DOM (#planetOverlay exists in your updated index)
function showPlanetOverlay(planetIndex, focusTier = null) {
  const ov = document.getElementById('planetOverlay');
  if (!ov) return;
  const title = ov.querySelector('#overlayTitle');
  const body = ov.querySelector('#overlayBody');
  if (!title || !body) return;
  const p = achievements.planets[planetIndex];
  title.innerText = p.planetName || `Planet ${planetIndex + 1}`;
  body.innerHTML = '';

  // list tiers as location cards
  (p.tiers || []).forEach((t, j) => {
    const card = document.createElement('div');
    card.className = 'location-card';
    const heading = document.createElement('div');
    heading.className = 'location-title';
    heading.innerText = t.tierName || `Tier ${j + 1}`;
    const nodesWrap = document.createElement('div');
    nodesWrap.className = 'location-nodes';
    (t.achievements || []).forEach((a, k) => {
      const pill = document.createElement('div');
      pill.className = 'node-pill';
      pill.innerText = a.title;
      if (a.status === 'available') pill.classList.add('available');
      if (a.status === 'completed') pill.classList.add('completed');
      pill.onclick = () => {
        focusedPlanet = planetIndex;
        focusedTier = j;
        // zoom to tier
        const pL = planetLayout[planetIndex];
        const baseAngle = (j / Math.max(1, p.tiers.length)) * Math.PI * 2;
        const jitterA = deterministicNoise(planetIndex, j, 1) * 0.6;
        const tangle = baseAngle + jitterA;
        const dist = 110 + deterministicNoise(planetIndex, j, 2) * 20;
        const tx = pL.px + Math.cos(tangle) * dist;
        const ty = pL.py + Math.sin(tangle) * dist;
        targetCamera.x = -tx;
        targetCamera.y = -ty;
        targetCamera.scale = 3.6;
        ov.style.display = 'none';
        // show achievement popup
        showAchievementPopup(planetIndex, j, k);
      };
      nodesWrap.appendChild(pill);
    });
    card.appendChild(heading);
    card.appendChild(nodesWrap);
    body.appendChild(card);
  });

  // show overlay
  ov.style.display = 'flex';
}

// Open junction modal (if present)
function openJunction(planetIndex, tierIndex) {
  const modal = document.getElementById('junctionModal');
  const title = document.getElementById('junctionTitle');
  const tasks = document.getElementById('junctionTasks');
  if (!modal || !title || !tasks) {
    // fallback: alert with tasks
    const p = achievements.planets[planetIndex];
    const t = p.tiers[tierIndex];
    const txt = (t.achievements || []).map(a => `• ${a.title}`).join('\n');
    alert(`Junction tasks for ${t.tierName || 'tier'}:\n\n${txt}`);
    return;
  }
  const p = achievements.planets[planetIndex];
  const t = p.tiers[tierIndex];
  title.innerText = `${p.planetName} — ${t.tierName} Junction`;
  tasks.innerHTML = '';
  // try explicit junction tasks if present
  if (p.junction?.tasks?.length) {
    p.junction.tasks.forEach(x => {
      const d = document.createElement('div');
      d.className = 'junction-task';
      d.innerText = x;
      tasks.appendChild(d);
    });
  } else {
    // fallback show a few achievements as goals
    (t.achievements || []).slice(0, 6).forEach(a => {
      const d = document.createElement('div');
      d.className = 'junction-task';
      d.innerHTML = `<strong>${a.title}</strong><div style="color:rgba(255,255,255,0.6)">${a.description || ''}</div>`;
      tasks.appendChild(d);
    });
  }
  modal.style.display = 'flex';
}

// complete achievement and persist (same behavior)
window.completeAchievement = function (core, tier, ach) {
  const a = achievements.planets[core].tiers[tier].achievements[ach];
  if (!a) return;
  a.status = 'completed';
  a.dateCompleted = new Date().toISOString();
  localStorage.setItem('progress', JSON.stringify(achievements));

  // unlock next tier if all completed
  const allCompleted = achievements.planets[core].tiers[tier].achievements.every(x => x.status === 'completed');
  if (allCompleted && tier < achievements.planets[core].tiers.length - 1) {
    achievements.planets[core].tiers[tier + 1].achievements.forEach(x => {
      if (x.status === 'locked') x.status = 'available';
    });
  }
};

// Admin UI is preserved as in original repo (no changes)
const adminPanel = document.getElementById('adminPanel');
const editContent = document.getElementById('editContent');
window.showAdminPanel = () => { if (adminPanel) adminPanel.style.display = 'block'; };
window.closeAdmin = () => { if (adminPanel) adminPanel.style.display = 'none'; if (editContent) editContent.style.display = 'none'; };

window.loginAdmin = () => {
  const passEl = document.getElementById('adminPassword');
  const pass = passEl ? passEl.value : '';
  if (pass === 'admin') {
    let html = '';
    (achievements.planets || []).forEach((p, i) => {
      html += `<h3>${p.planetName}</h3>`;
      p.tiers.forEach((t, j) => {
        html += `<h4>${t.tierName}</h4>`;
        t.achievements.forEach((a, k) => {
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
  } else {
    alert('Wrong password');
  }
};
window.editTitle = (i, j, k, v) => { achievements.planets[i].tiers[j].achievements[k].title = v; };
window.editDesc = (i, j, k, v) => { achievements.planets[i].tiers[j].achievements[k].description = v; };
window.editStatus = (i, j, k, v) => {
  achievements.planets[i].tiers[j].achievements[k].status = v;
  achievements.planets[i].tiers[j].achievements[k].dateCompleted = v === 'completed' ? new Date().toISOString() : null;
};
window.downloadJson = () => {
  const blob = new Blob([JSON.stringify(achievements, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'achievements.json';
  a.click();
};
window.bulkUnlock = () => {
  (achievements.planets || []).forEach(p => p.tiers.forEach(t => t.achievements.forEach(a => a.status = 'available')));
  alert('All unlocked');
};
window.bulkReset = () => {
  (achievements.planets || []).forEach(p => p.tiers.forEach((t, j) => t.achievements.forEach(a => {
    a.status = j === 0 ? 'available' : 'locked';
    a.dateCompleted = null;
  })));
  alert('All reset');
};

// Close side panel / overlays when clicking outside (safe checks)
document.addEventListener('click', (e) => {
  const side = document.getElementById('sidePanel');
  const overlay = document.getElementById('planetOverlay');
  const junction = document.getElementById('junctionModal');
  const achPop = document.getElementById('achievementPopup');

  // If click target is not inside a visible panel and not inside canvas, hide them
  const clickInsideSide = side && side.contains(e.target);
  const clickInsideOverlay = overlay && overlay.contains(e.target);
  const clickInsideJunc = junction && junction.contains(e.target);
  const clickInsidePopup = achPop && achPop.contains(e.target);
  const clickInsideCanvas = canvas && (e.target === canvas || canvas.contains(e.target));

  if (!clickInsideSide && !clickInsideCanvas) {
    if (side) side.style.display = 'none';
  }
  if (!clickInsideOverlay && !clickInsideCanvas) {
    if (overlay) overlay.style.display = 'none';
  }
  if (!clickInsideJunc && !clickInsideCanvas) {
    if (junction) junction.style.display = 'none';
  }
  if (!clickInsidePopup && !clickInsideCanvas) {
    if (achPop) achPop.style.display = 'none';
  }
});

// small helper to escape HTML in admin
function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// initial compute layout if JSON was not loaded at script start
if (!planetLayout.length) computeOrbitLayout();

// end of file
