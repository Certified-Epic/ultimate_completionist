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
const tierRadius = 120;
const planetSize = 60;
const tierSize = 36;
const achievementSize = 12;
const orbitSpeed = 0.05; // Slow orbiting speed for planets around central hub

// utility distance (ensure this is defined before any mouse handlers)
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

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

document.getElementById('zoomOutBtn').addEventListener('click', () => { targetCamera.scale = 0.6; focusedCore = focusedTier = null; hideSidePanel(); });
document.getElementById('recenterBtn').addEventListener('click', () => { targetCamera.x = 0; targetCamera.y = 0; });

junctionClose.addEventListener('click', () => junctionModal.style.display = 'none');
junctionComplete.addEventListener('click', () => {
  // For demo we just close — specific logic can be wired into achievement completion
  junctionModal.style.display = 'none';
});

// build side panel skeleton
function buildSidePanel(){
  if (!achievements.planets?.length) return;
  sidePanel.style.display = 'flex';
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

  // center image
  ctx.save();
  ctx.drawImage(assets.center, -60, -60, 120, 120);
  ctx.restore();

  // Glowing orbit line for planets (futuristic minimal style)
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100, 223, 255, 0.2)'; // Glowing blue line
  ctx.lineWidth = 2 / camera.scale;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(100, 223, 255, 0.5)';
  ctx.stroke();
  ctx.shadowBlur = 0;

  // planets rendering
  if (achievements.planets) {
    achievements.planets.forEach((planet, i) => {
      const baseAngle = i * (2 * Math.PI / achievements.planets.length) - Math.PI / 2;
      const angle = baseAngle + time * orbitSpeed; // Add orbiting animation
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;

      // when hovered, draw an outer glow ring
      if (hovered && hovered.type === 'core' && hovered.index === i) {
        ctx.beginPath();
        ctx.lineWidth = 6 / camera.scale;
        ctx.strokeStyle = 'rgba(100,223,255,0.12)';
        ctx.arc(px, py, planetSize * 0.9 + 12 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // planet sprite
      ctx.drawImage(assets.planet, px - planetSize / 2, py - planetSize / 2, planetSize, planetSize);

      // planet label (only when zoomed in)
      if (camera.scale > 0.9) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(planet.planetName, px, py + planetSize / 2 + 12);
      }

      // Focused planet view
      if (focusedCore === i) {
        // Draw concentric tiers
        const p = achievements.planets[i];
        p.tiers.forEach((t, j) => {
          // Tier circle
          ctx.beginPath();
          ctx.arc(0, 0, tierRadius * (j + 1), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(100, 223, 255, 0.15)';
          ctx.lineWidth = 1 / camera.scale;
          ctx.stroke();

          // Achievements nodes
          t.achievements.forEach((a, k) => {
            const achAngle = k * (2 * Math.PI / t.achievements.length);
            const ax = Math.cos(achAngle) * (tierRadius * (j + 1));
            const ay = Math.sin(achAngle) * (tierRadius * (j + 1));

            // Glowing line to node
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ax, ay);
            ctx.strokeStyle = 'rgba(100,223,255,0.15)';
            ctx.lineWidth = 1 / camera.scale;
            ctx.stroke();

            if (a.status === 'locked') {
              ctx.drawImage(assets.lock, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
            } else if (a.status === 'completed') {
              // Simple icon for completed
              ctx.drawImage(assets.node, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
            } else {
              // Available: pulsing glow
              const pulseScale = 1 + Math.sin(time * 4) * 0.1;
              ctx.globalAlpha = 0.5 + Math.abs(Math.sin(time * 3)) * 0.5;
              ctx.drawImage(assets.pulse, ax - achievementSize * pulseScale / 2, ay - achievementSize * pulseScale / 2, achievementSize * pulseScale, achievementSize * pulseScale);
              ctx.globalAlpha = 1;
              ctx.drawImage(assets.node, ax - achievementSize / 2, ay - achievementSize / 2, achievementSize, achievementSize);
            }
          });
        });

        // Draw junctions between tiers (larger nodes as progression gateways)
        for (let j = 0; j < p.tiers.length - 1; j++) {
          if (p.tiers[j].junctionTasks && p.tiers[j].junctionTasks.length > 0) {
            const junctionAngle = Math.PI; // Fixed angle (e.g., bottom position for consistency)
            const junctionRad = tierRadius * (j + 1.5); // Midway between current and next tier
            const jx = Math.cos(junctionAngle) * junctionRad;
            const jy = Math.sin(junctionAngle) * junctionRad;

            // Glow if hovered
            if (hovered && hovered.type === 'junction' && hovered.planet === i && hovered.tier === j) {
              ctx.beginPath();
              ctx.lineWidth = 6 / camera.scale;
              ctx.strokeStyle = 'rgba(100,223,255,0.3)';
              ctx.arc(jx, jy, tierSize * 0.9 + 8 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Draw junction icon
            ctx.drawImage(assets.junction, jx - tierSize / 2, jy - tierSize / 2, tierSize, tierSize);

            // Glowing line from planet center to junction
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(jx, jy);
            ctx.strokeStyle = 'rgba(100,223,255,0.3)';
            ctx.lineWidth = 1 / camera.scale;
            ctx.shadowBlur = 5;
            ctx.shadowColor = 'rgba(100,223,255,0.5)';
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
    });
  }

  ctx.restore();
  requestAnimationFrame(draw);
}
draw();

// Mouse interaction
let mouseX, mouseY;
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left - width / 2) / camera.scale - camera.x;
  mouseY = (e.clientY - rect.top - height / 2) / camera.scale - camera.y;
  hovered = null;
  hoverInfo.style.opacity = 0;

  if (focusedCore !== null) {
    const p = achievements.planets[focusedCore];
    // Check hover for junctions
    for (let j = 0; j < p.tiers.length - 1; j++) {
      if (p.tiers[j].junctionTasks && p.tiers[j].junctionTasks.length > 0) {
        const junctionAngle = Math.PI;
        const junctionRad = tierRadius * (j + 1.5);
        const jx = Math.cos(junctionAngle) * junctionRad;
        const jy = Math.sin(junctionAngle) * junctionRad;
        if (distance(mouseX, mouseY, jx, jy) < tierSize / 2) {
          hovered = { type: 'junction', planet: focusedCore, tier: j };
          hoverInfo.innerHTML = `<div class="hi-title">Junction to ${p.tiers[j + 1].tierName}</div><div class="hi-resources">Complete tasks to unlock next tier.</div>`;
          hoverInfo.style.opacity = 1;
          hoverInfo.style.left = `${e.clientX + 10}px`;
          hoverInfo.style.top = `${e.clientY + 10}px`;
          return;
        }
      }
    }
    // Add hover checks for achievements if needed
  } else {
    // Hover for planets in core view
    achievements.planets.forEach((planet, i) => {
      const baseAngle = i * (2 * Math.PI / achievements.planets.length) - Math.PI / 2;
      const angle = baseAngle + time * orbitSpeed;
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;
      if (distance(mouseX, mouseY, px, py) < planetSize / 2) {
        hovered = { type: 'core', index: i };
        hoverInfo.innerHTML = `<div class="hi-title">${planet.planetName}</div><div class="hi-resources">Click to zoom in.</div>`;
        hoverInfo.style.opacity = 1;
        hoverInfo.style.left = `${e.clientX + 10}px`;
        hoverInfo.style.top = `${e.clientY + 10}px`;
        return;
      }
    });
  }
});

canvas.addEventListener('click', (e) => {
  if (hovered) {
    if (hovered.type === 'core') {
      focusedCore = hovered.index;
      targetCamera.scale = 2.0; // Zoom in
      const baseAngle = hovered.index * (2 * Math.PI / achievements.planets.length) - Math.PI / 2;
      const angle = baseAngle + time * orbitSpeed;
      targetCamera.x = -Math.cos(angle) * coreRadius;
      targetCamera.y = -Math.sin(angle) * coreRadius;
      // Show side panel etc. (add your logic)
      populateSidePanelForPlanet(hovered.index); // Assuming a function to populate side panel
    } else if (hovered.type === 'junction') {
      showJunctionModal(achievements.planets[hovered.planet].planetName, achievements.planets[hovered.planet].tiers[hovered.tier]);
    }
    // Add other click logic for nodes if needed
  }
});

// Other functions (from original, assuming they exist; adjust as needed)
function hideSidePanel() {
  sidePanel.style.display = 'none';
}

function populateSidePanelForPlanet(planetIndex) {
  // Example function to show side panel for focused planet
  sidePanel.style.display = 'flex';
  const p = achievements.planets[planetIndex];
  planetNameEl.innerText = p.planetName;
  // Populate tiers, etc.
}

function populateSidePanelForTier(coreIndex, tierIndex) {
  const p = achievements.planets[coreIndex];
  const t = p.tiers[tierIndex];
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

// shows junction modal
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

window.showAdminPanel = () => { adminPanel.style.display = 'block'; };
window.closeAdmin = () => { adminPanel.style.display = 'none'; editContent.style.display = 'none'; };

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

// Placeholder for showAchievementPopup if not defined
function showAchievementPopup(coreIndex, tierIndex, achIndex) {
  // Implement popup display logic here
  popup.style.display = 'block';
  // Populate popup with achievement details
}
