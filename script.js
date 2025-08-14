// script.js
// Updated script.js — improved interface & hover/tier/junction UI
// Keeps achievements.json untouched and still uses localStorage for progress.

// -- Canvas setup & asset loading --
const canvas = document.getElementById('starChart');
const ctx = canvas.getContext('2d');
let width, height;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Images (do not edit files, just referencing)
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

// Sounds (optional)
const sounds = {
  hover: new Audio('./assets/hover.mp3'),
  zoom: new Audio('./assets/zoom.mp3'),
  background: new Audio('./assets/background.mp3')
};
sounds.background.loop = true;
sounds.background.volume = 0.35;
try{ sounds.background.play().catch(()=>{}); } catch(e){ /* autoplay blocked sometimes */ }

// Achievements (loaded from file, don't modify achievements.json)
let achievements = {};
fetch('./achievements.json')
  .then(r => r.json())
  .then(data => {
    achievements = data;
    // merge saved progress (backwards compatible)
    const saved = localStorage.getItem('progress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        if (progress.planets) {
          progress.planets.forEach((p, i) => {
            p.tiers.forEach((t, j) => {
              t.achievements.forEach((a, k) => {
                if (achievements.planets?.[i]?.tiers?.[j]?.achievements?.[k]) {
                  achievements.planets[i].tiers[j].achievements[k].status = a.status;
                  achievements.planets[i].tiers[j].achievements[k].dateCompleted = a.dateCompleted || null;
                }
              });
            });
          });
        }
      } catch(e){}
    }
    buildSidePanel(); // show minimal UI if data present
  })
  .catch(err => {
    console.error('Failed to load achievements.json', err);
  });

// -- Camera & navigation setup --
let camera = { x: 0, y: 0, scale: 0.6 };
let targetCamera = { x: 0, y: 0, scale: 0.6 };
const easing = 0.12;

let focusedCore = null;   // planet index
let focusedTier = null;   // tier index
let hovered = null;       // hover info object

// Visual constants (tweakable)
const coreRadius = 380;
const tierRadius = 180; // Increased for better layout
const planetSize = 80; // Increased size
const tierSize = 48; // Increased size
const achievementSize = 12;

// Starfield
let starParticles = [];
for (let i = 0; i < 220; i++) {
  starParticles.push({
    x: Math.random() * 2000 - 1000,
    y: Math.random() * 2000 - 1000,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.6 + 0.2,
    alpha: Math.random() * 0.7 + 0.3
  });
}
let time = 0;

// DOM elements for UI
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
  targetCamera.scale = 0.6; 
  targetCamera.x = 0; 
  targetCamera.y = 0; 
  focusedCore = focusedTier = null; 
  sidePanel.classList.add('hidden');
});
document.getElementById('recenterBtn').addEventListener('click', () => { targetCamera.x = 0; targetCamera.y = 0; });

junctionClose.addEventListener('click', () => junctionModal.classList.add('hidden'));
junctionComplete.addEventListener('click', () => {
  // For demo we just close — specific logic can be wired into achievement completion
  junctionModal.classList.add('hidden');
});

// build side panel skeleton
function buildSidePanel(){
  if (!achievements.planets?.length) return;
  sidePanel.classList.remove('hidden');
  document.getElementById('sideTitle').innerText = 'Star Chart — Achievements';
}

// -- Main render loop --
function draw() {
  time += 0.016;
  // camera easing
  camera.x += (targetCamera.x - camera.x) * easing;
  camera.y += (targetCamera.y - camera.y) * easing;
  camera.scale += (targetCamera.scale - camera.scale) * easing;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  // starfield
  starParticles.forEach(p => {
    ctx.globalAlpha = p.alpha * 0.8;
    ctx.fillStyle = 'white';
    ctx.fillRect(p.x, p.y, p.size, p.size);
    p.x -= p.speed;
    if (p.x < -1200) p.x = 1200;
  });
  ctx.globalAlpha = 1;

  // Draw main orbit circle for planets (static)
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.lineWidth = 2 / camera.scale;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.stroke();

  // center image - larger
  ctx.save();
  ctx.drawImage(assets.center, -120, -120, 240, 240);
  ctx.restore();

  // planets rendering
  if (achievements.planets) {
    achievements.planets.forEach((planet, i) => {
      const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;

      // Draw orbit for tiers around planet (static)
      if (focusedCore === i || camera.scale > 1.5) {
        ctx.beginPath();
        ctx.arc(px, py, tierRadius, 0, Math.PI * 2);
        ctx.lineWidth = 2 / camera.scale;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.stroke();
      }

      // when hovered, draw an outer glow ring
      if (hovered && hovered.type === 'core' && hovered.index === i) {
        ctx.beginPath();
        ctx.lineWidth = 6 / camera.scale;
        ctx.strokeStyle = 'rgba(100,223,255,0.12)';
        ctx.arc(px, py, planetSize*0.9 + 12 + Math.sin(time*3)*3, 0, Math.PI*2);
        ctx.stroke();
      }

      // planet sprite
      ctx.drawImage(assets.planet, px - planetSize/2, py - planetSize/2, planetSize, planetSize);

      // planet label
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 16px Arial'; // Larger font
      ctx.textAlign = 'center';
      ctx.fillText(planet.planetName || `Planet ${i+1}`, px, py + planetSize/2 + 18);

      // draw tiers around planet
      planet.tiers.forEach((tier, j) => {
        const tangle = j * (2 * Math.PI / planet.tiers.length);
        const tx = px + Math.cos(tangle) * tierRadius;
        const ty = py + Math.sin(tangle) * tierRadius;

        // connecting line - curved for better layout
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2 / camera.scale;
        ctx.beginPath(); 
        ctx.moveTo(px, py); 
        ctx.quadraticCurveTo(px + Math.cos(tangle) * tierRadius / 2, py + Math.sin(tangle) * tierRadius / 2, tx, ty); 
        ctx.stroke();

        // tier icon
        ctx.drawImage(assets.node, tx - tierSize/2, ty - tierSize/2, tierSize, tierSize); // Use node image for tiers

        // tier label
        if (camera.scale > 1.5) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '500 14px Arial';
          ctx.fillText(tier.tierName || `Node ${j+1}`, tx, ty + tierSize/2 + 14);
        }

        // highlight when focused
        if (focusedCore === i && focusedTier === j) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(100,223,255,0.6)';
          ctx.lineWidth = 3 / camera.scale;
          ctx.arc(tx, ty, tierSize, 0, Math.PI*2); ctx.stroke();
        }

        // when hovered on tier
        if (hovered && hovered.type === 'tier' && hovered.core === i && hovered.index === j) {
          ctx.beginPath();
          ctx.lineWidth = 4 / camera.scale;
          ctx.strokeStyle = 'rgba(100,223,255,0.15)';
          ctx.arc(tx, ty, tierSize + 8 + Math.sin(time*2)*2, 0, Math.PI*2);
          ctx.stroke();
        }
      });
    });
  }

  ctx.restore();
  requestAnimationFrame(draw);
}
draw();

// Mouse interaction
let isDragging = false;
let lastMouseX, lastMouseY;

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  detectClick(e); // Detect click for zoom/focus
});

canvas.addEventListener('mousemove', (e) => {
  const mx = (e.clientX - width / 2) / camera.scale - camera.x;
  const my = (e.clientY - height / 2) / camera.scale - camera.y;
  hovered = detectHover(mx, my);
  updateHoverInfo(e.clientX, e.clientY);

  if (isDragging) {
    targetCamera.x += (e.clientX - lastMouseX) / camera.scale;
    targetCamera.y += (e.clientY - lastMouseY) / camera.scale;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});

canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mouseleave', () => { isDragging = false; hoverInfo.classList.remove('show'); });

// Mouse wheel for zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = -e.deltaY / 1000;
  targetCamera.scale = Math.max(0.3, Math.min(5, targetCamera.scale + delta));
  sounds.zoom.play().catch(() => {});
});

// Detect hover
function detectHover(mx, my) {
  if (achievements.planets) {
    for (let i = 0; i < achievements.planets.length; i++) {
      const planet = achievements.planets[i];
      const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;
      if (distance(mx, my, px, py) < planetSize / 2) {
        return { type: 'core', index: i, name: planet.planetName, desc: `${planet.tiers.length} Nodes` };
      }
      for (let j = 0; j < planet.tiers.length; j++) {
        const tangle = j * (2 * Math.PI / planet.tiers.length);
        const tx = px + Math.cos(tangle) * tierRadius;
        const ty = py + Math.sin(tangle) * tierRadius;
        if (distance(mx, my, tx, ty) < tierSize / 2) {
          return { type: 'tier', core: i, index: j, name: planet.tiers[j].tierName, desc: `${planet.tiers[j].achievements.length} Achievements` };
        }
      }
    }
  }
  return null;
}

// Update hover info
function updateHoverInfo(clientX, clientY) {
  if (hovered) {
    hoverInfo.querySelector('.hi-title').innerText = hovered.name || 'Unknown';
    hoverInfo.querySelector('.hi-resources').innerText = hovered.desc || '';
    hoverInfo.style.left = `${clientX + 15}px`;
    hoverInfo.style.top = `${clientY + 15}px`;
    hoverInfo.classList.add('show');
    sounds.hover.play().catch(() => {});
  } else {
    hoverInfo.classList.remove('show');
  }
}

// Detect click for focus/zoom
function detectClick(e) {
  const mx = (e.clientX - width / 2) / camera.scale - camera.x;
  const my = (e.clientY - height / 2) / camera.scale - camera.y;
  const clicked = detectHover(mx, my); // Reuse hover detection
  if (clicked) {
    if (clicked.type === 'core') {
      const i = clicked.index;
      const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;
      targetCamera.x = -px;
      targetCamera.y = -py;
      targetCamera.scale = 2.0; // Zoom in to planet level
      focusedCore = i;
      focusedTier = null;
      populateSidePanelForPlanet(i);
      sounds.zoom.play().catch(() => {});
    } else if (clicked.type === 'tier') {
      const i = clicked.core;
      const j = clicked.index;
      const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;
      const tangle = j * (2 * Math.PI / achievements.planets[i].tiers.length);
      const tx = px + Math.cos(tangle) * tierRadius;
      const ty = py + Math.sin(tangle) * tierRadius;
      targetCamera.x = -tx;
      targetCamera.y = -ty;
      targetCamera.scale = 4.0; // Zoom closer to node
      focusedCore = i;
      focusedTier = j;
      populateSidePanelForTier(i, j);
      sounds.zoom.play().catch(() => {});
    }
  }
}

// populate side panel for planet (shows tiers)
function populateSidePanelForPlanet(coreIndex) {
  const p = achievements.planets[coreIndex];
  if (!p) return;
  sidePanel.classList.remove('hidden');
  document.getElementById('sideTitle').innerText = `${p.planetName} System`;
  planetNameEl.innerText = p.planetName;
  planetMetaEl.innerText = `${p.tiers.length} Nodes`;
  tiersList.innerHTML = '';
  p.tiers.forEach((t, j) => {
    const card = document.createElement('div'); card.className = 'tier-card';
    const meta = document.createElement('div'); meta.className = 'tier-meta';
    meta.innerHTML = `<div class="tier-title">${t.tierName}</div><div class="tier-desc">${t.achievements.length} achievements</div>`;
    card.appendChild(meta);
    const achWrap = document.createElement('div'); achWrap.className = 'tier-achievements';
    t.achievements.forEach((a,k) => {
      const pill = document.createElement('div'); pill.className = 'ach-pill';
      pill.innerText = `${a.title}`;
      pill.onclick = () => { showAchievementPopup(coreIndex, j, k); };
      achWrap.appendChild(pill);
    });
    card.appendChild(achWrap);
    tiersList.appendChild(card);
  });

  // junction section
  junctionList.innerHTML = '';
  const fallback = document.createElement('div'); fallback.className = 'junction-task';
  fallback.innerHTML = `<strong>System Junctions</strong><div style="color:var(--muted); margin-top:6px;">Navigate to nodes for details.</div>`;
  junctionList.appendChild(fallback);
}

// populate side panel for a specific tier
function populateSidePanelForTier(coreIndex, tierIndex) {
  const p = achievements.planets[coreIndex];
  if (!p) return;
  const t = p.tiers[tierIndex];
  sidePanel.classList.remove('hidden');
  document.getElementById('sideTitle').innerText = `${p.planetName} — ${t.tierName}`;
  planetNameEl.innerText = `${p.planetName} — ${t.tierName}`;
  planetMetaEl.innerText = `${t.achievements.length} achievements • Node ${tierIndex+1}`;
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

  // junction section — attempt to show junction tasks or link to next tier
  junctionList.innerHTML = '';
  if (t.junctionTasks && t.junctionTasks.length) {
    junctionTitle.innerText = `${p.planetName} — ${t.tierName} Junction`;
    t.junctionTasks.forEach(task => {
      const node = document.createElement('div'); node.className = 'junction-task';
      node.innerText = task;
      junctionList.appendChild(node);
    });
  } else {
    // fallback: show the top 3 achievements as junction hints
    junctionTitle.innerText = `${p.planetName} — Node ${tierIndex+1} Hints`;
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

// shows achievement popup
function showAchievementPopup(coreIndex, tierIndex, achIndex) {
  const a = achievements.planets[coreIndex].tiers[tierIndex].achievements[achIndex];
  popup.innerHTML = `<h2>${a.title}</h2><p>${a.description || 'No description'}</p><p>Status: ${a.status}</p>`;
  if (a.status !== 'completed') {
    const btn = document.createElement('button');
    btn.innerText = 'Complete';
    btn.onclick = () => completeAchievement(coreIndex, tierIndex, achIndex);
    popup.appendChild(btn);
  }
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 5000); // Auto hide
}

// shows junction modal
function showJunctionModal(planetName, tierObj) {
  junctionModal.classList.remove('hidden');
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

// complete achievement function (keeps original semantics)
window.completeAchievement = (core, tier, ach) => {
  const a = achievements.planets[core].tiers[tier].achievements[ach];
  if (!a) return;
  a.status = 'completed';
  a.dateCompleted = new Date().toISOString();
  localStorage.setItem('progress', JSON.stringify(achievements));
  // Unlock next tier achievements if fully complete
  const allCompleted = achievements.planets[core].tiers[tier].achievements.every(x => x.status === 'completed');
  if (allCompleted && tier < achievements.planets[core].tiers.length - 1) {
    achievements.planets[core].tiers[tier + 1].achievements.forEach(x => {
      if (x.status === 'locked') x.status = 'available';
    });
  }
  // refresh UI
  populateSidePanelForTier(core, tier);
};

// Admin functions (kept but with nicer UI hooks)
const adminPanel = document.getElementById('adminPanel');
const editContent = document.getElementById('editContent');

window.showAdminPanel = () => { adminPanel.classList.remove('hidden'); };
window.closeAdmin = () => { adminPanel.classList.add('hidden'); editContent.style.display = 'none'; };

window.loginAdmin = () => {
  if (document.getElementById('adminPassword').value === 'admin') {
    // build editable form
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

function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
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

window.bulkUnlock = () => {
  achievements.planets.forEach(p => p.tiers.forEach(t => t.achievements.forEach(a => a.status = 'available')));
  alert('All unlocked');
};

window.bulkReset = () => {
  achievements.planets.forEach(p => p.tiers.forEach((t,j) => t.achievements.forEach(a => {
    a.status = j === 0 ? 'available' : 'locked';
    a.dateCompleted = null;
  })));
  alert('All reset');
};
