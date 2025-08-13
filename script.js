// Updated script.js — improved Warframe-style interface
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

// Visual constants (tweakable for Warframe aesthetic)
const coreRadius = 380;
const tierRadius = 120;
const planetSize = 60;
const tierSize = 36;
const achievementSize = 12;

// Enhanced starfield with nebula effect
let starParticles = [];
let nebulaParticles = [];

for (let i = 0; i < 300; i++) {
 starParticles.push({
   x: Math.random() * 4000 - 2000,
   y: Math.random() * 4000 - 2000,
   size: Math.random() * 3 + 0.5,
   speed: Math.random() * 0.8 + 0.2,
   alpha: Math.random() * 0.8 + 0.2,
   twinkle: Math.random() * Math.PI * 2
 });
}

for (let i = 0; i < 50; i++) {
 nebulaParticles.push({
   x: Math.random() * 3000 - 1500,
   y: Math.random() * 3000 - 1500,
   size: Math.random() * 100 + 50,
   speed: Math.random() * 0.3 + 0.1,
   alpha: Math.random() * 0.1 + 0.05,
   hue: Math.random() * 60 + 180 // cyan-blue range
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
 focusedCore = focusedTier = null; 
 hideSidePanel(); 
 playWarframeSound('zoom');
});

document.getElementById('recenterBtn').addEventListener('click', () => { 
 targetCamera.x = 0; 
 targetCamera.y = 0; 
 playWarframeSound('zoom');
});

junctionClose.addEventListener('click', () => {
 junctionModal.style.display = 'none';
 playWarframeSound('hover');
});

junctionComplete.addEventListener('click', () => {
 junctionModal.style.display = 'none';
 playWarframeSound('hover');
});

// Enhanced sound system
function playWarframeSound(type) {
 try {
   if (sounds[type]) {
     sounds[type].currentTime = 0;
     sounds[type].play().catch(()=>{});
   }
 } catch(e) {}
}

// build side panel skeleton
function buildSidePanel(){
 if (!achievements.planets?.length) return;
 sidePanel.style.display = 'flex';
 document.getElementById('sideTitle').innerText = 'STAR CHART';
}

function hideSidePanel() {
 document.getElementById('planetSummary').classList.add('hidden');
 tiersSection.classList.add('hidden');
 junctionSection.classList.add('hidden');
}

// -- Enhanced rendering with Warframe visual effects --
function draw() {
 time += 0.016;
 // camera easing
 camera.x += (targetCamera.x - camera.x) * easing;
 camera.y += (targetCamera.y - camera.y) * easing;
 camera.scale += (targetCamera.scale - camera.scale) * easing;

 // Clear with subtle gradient background
 const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height));
 gradient.addColorStop(0, 'rgba(10, 14, 20, 1)');
 gradient.addColorStop(0.5, 'rgba(19, 25, 37, 0.8)');
 gradient.addColorStop(1, 'rgba(6, 8, 12, 1)');
 ctx.fillStyle = gradient;
 ctx.fillRect(0, 0, width, height);

 ctx.save();
 ctx.translate(width / 2, height / 2);
 ctx.scale(camera.scale, camera.scale);
 ctx.translate(camera.x, camera.y);

 // Enhanced nebula rendering
 nebulaParticles.forEach(p => {
   ctx.globalAlpha = p.alpha * (0.5 + Math.sin(time + p.x * 0.001) * 0.3);
   const nebulaGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
   nebulaGradient.addColorStop(0, `hsla(${p.hue}, 70%, 60%, ${p.alpha})`);
   nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
   ctx.fillStyle = nebulaGradient;
   ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
   p.x -= p.speed;
   p.y += Math.sin(time * 0.5 + p.x * 0.01) * 0.2;
   if (p.x < -2000) p.x = 2000;
 });

 // Enhanced starfield with twinkling
 starParticles.forEach(p => {
   p.twinkle += 0.05;
   ctx.globalAlpha = p.alpha * (0.3 + Math.sin(p.twinkle) * 0.7);
   
   // Star color based on size
   if (p.size > 2) {
     ctx.fillStyle = '#00d4ff'; // Cyan for larger stars
   } else if (p.size > 1.5) {
     ctx.fillStyle = '#ffffff';
   } else {
     ctx.fillStyle = '#a8b5c8';
   }
   
   // Add slight glow for larger stars
   if (p.size > 2) {
     ctx.shadowColor = '#00d4ff';
     ctx.shadowBlur = 4;
   } else {
     ctx.shadowBlur = 0;
   }
   
   ctx.fillRect(p.x, p.y, p.size, p.size);
   p.x -= p.speed;
   if (p.x < -2200) p.x = 2200;
 });
 
 ctx.globalAlpha = 1;
 ctx.shadowBlur = 0;

 // Enhanced center image with pulsing glow
 ctx.save();
 const centerPulse = 1 + Math.sin(time * 2) * 0.1;
 ctx.shadowColor = '#00d4ff';
 ctx.shadowBlur = 20;
 ctx.drawImage(assets.center, -60 * centerPulse, -60 * centerPulse, 120 * centerPulse, 120 * centerPulse);
 
 // Add energy rings around center
 for (let i = 0; i < 3; i++) {
   ctx.beginPath();
   ctx.strokeStyle = `rgba(0, 212, 255, ${0.1 - i * 0.03})`;
   ctx.lineWidth = 2;
   const ringRadius = 80 + i * 30 + Math.sin(time * (2 + i)) * 10;
   ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
   ctx.stroke();
 }
 ctx.restore();

 // Enhanced planets rendering
 if (achievements.planets) {
   achievements.planets.forEach((planet, i) => {
     const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
     const px = Math.cos(angle) * coreRadius;
     const py = Math.sin(angle) * coreRadius;

     // Enhanced hover effects
     if (hovered && hovered.type === 'core' && hovered.index === i) {
       // Outer energy ring
       ctx.beginPath();
       ctx.lineWidth = 4 / camera.scale;
       ctx.strokeStyle = `rgba(0, 212, 255, ${0.6 + Math.sin(time*4) * 0.2})`;
       ctx.arc(px, py, planetSize*0.9 + 20 + Math.sin(time*3)*5, 0, Math.PI*2);
       ctx.stroke();
       
       // Inner pulse
       ctx.beginPath();
       ctx.fillStyle = `rgba(0, 212, 255, ${0.1 + Math.sin(time*6) * 0.05})`;
       ctx.arc(px, py, planetSize*0.5 + Math.sin(time*4)*3, 0, Math.PI*2);
       ctx.fill();
     }

     // Planet with enhanced glow
     ctx.save();
     ctx.shadowColor = '#00d4ff';
     ctx.shadowBlur = 8;
     ctx.drawImage(assets.planet, px - planetSize/2, py - planetSize/2, planetSize, planetSize);
     ctx.restore();

     // Planet label with enhanced styling
     if (camera.scale > 0.9) {
       ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
       ctx.font = '700 14px Orbitron, Arial';
       ctx.textAlign = 'center';
       ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
       ctx.lineWidth = 3;
       const planetName = planet.planetName || `SECTOR ${i+1}`;
       ctx.strokeText(planetName, px, py + planetSize/2 + 18);
       ctx.fillText(planetName, px, py + planetSize/2 + 18);
     }

     // Enhanced connection lines with energy flow
     planet.tiers.forEach((tier, j) => {
       const tangle = j * (2 * Math.PI / planet.tiers.length);
       const tx = px + Math.cos(tangle) * tierRadius;
       const ty = py + Math.sin(tangle) * tierRadius;

       // Animated connection line
       ctx.strokeStyle = `rgba(0, 212, 255, ${0.2 + Math.sin(time*2 + j) * 0.1})`;
       ctx.lineWidth = 3 / camera.scale;
       ctx.beginPath(); 
       ctx.moveTo(px, py); 
       ctx.lineTo(tx, ty); 
       ctx.stroke();
       
       // Energy flow particles along the line
       const flowProgress = (time * 0.5 + j * 0.5) % 1;
       const flowX = px + (tx - px) * flowProgress;
       const flowY = py + (ty - py) * flowProgress;
       ctx.beginPath();
       ctx.fillStyle = `rgba(0, 212, 255, ${0.8 - flowProgress * 0.6})`;
       ctx.arc(flowX, flowY, 2, 0, Math.PI*2);
       ctx.fill();

       // Enhanced tier icon
       ctx.save();
       if (focusedCore === i && focusedTier === j) {
         ctx.shadowColor = '#00d4ff';
         ctx.shadowBlur = 12;
       }
       ctx.drawImage(assets.planet, tx - tierSize/2, ty - tierSize/2, tierSize, tierSize);
       ctx.restore();

       // Tier focus indicator
       if (focusedCore === i && focusedTier === j) {
         ctx.beginPath();
         ctx.strokeStyle = `rgba(0, 212, 255, ${0.8 + Math.sin(time*5) * 0.2})`;
         ctx.lineWidth = 4 / camera.scale;
         ctx.arc(tx, ty, tierSize + 8, 0, Math.PI*2); 
         ctx.stroke();
         
         // Rotating selection indicator
         ctx.save();
         ctx.translate(tx, ty);
         ctx.rotate(time);
         ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
         ctx.lineWidth = 2 / camera.scale;
         for (let k = 0; k < 4; k++) {
           const indicatorAngle = k * Math.PI / 2;
           const startRadius = tierSize + 12;
           const endRadius = tierSize + 20;
           ctx.beginPath();
           ctx.moveTo(Math.cos(indicatorAngle) * startRadius, Math.sin(indicatorAngle) * startRadius);
           ctx.lineTo(Math.cos(indicatorAngle) * endRadius, Math.sin(indicatorAngle) * endRadius);
           ctx.stroke();
         }
         ctx.restore();
       }

       // Enhanced junction markers
       if (j < planet.tiers.length - 1) {
         const jangle = (j + 0.5) * (2 * Math.PI / planet.tiers.length);
         const jx = px + Math.cos(jangle) * (tierRadius + 25);
         const jy = py + Math.sin(jangle) * (tierRadius + 25);
         
         ctx.save();
         ctx.shadowColor = '#ffd700';
         ctx.shadowBlur = 6;
         ctx.drawImage(assets.junction, jx - 10, jy - 10, 20, 20);
         ctx.restore();

         // Junction activity indicator
         if (focusedCore === i && (focusedTier === j || focusedTier === j + 1)) {
           ctx.beginPath();
           ctx.globalAlpha = 0.4 + Math.sin(time*4) * 0.3;
           ctx.strokeStyle = '#ffd700';
           ctx.lineWidth = 3 / camera.scale;
           ctx.arc(jx, jy, 15 + Math.sin(time*3) * 3, 0, Math.PI*2); 
           ctx.stroke();
           ctx.globalAlpha = 1;
         }
       }

       // Enhanced achievements display
       if (focusedCore === i && focusedTier === j) {
         tier.achievements.forEach((ach, k) => {
           const numAch = tier.achievements.length;
           const aangle = k * (2 * Math.PI / numAch);
           const ax = tx + Math.cos(aangle) * 55;
           const ay = ty + Math.sin(aangle) * 55;

           // Enhanced connector with data flow
           ctx.beginPath();
           ctx.strokeStyle = `rgba(0, 212, 255, ${0.3 + Math.sin(time*3 + k) * 0.2})`;
           ctx.lineWidth = 2 / camera.scale;
           ctx.moveTo(tx, ty); 
           ctx.lineTo(ax, ay); 
           ctx.stroke();

           // Achievement status-based rendering
           ctx.save();
           if (ach.status === 'available') {
             // Pulsing available achievement
             ctx.shadowColor = '#00ff88';
             ctx.shadowBlur = 8;
             const pulseScale = 1 + Math.sin(time*4 + k) * 0.2;
             ctx.drawImage(assets.pulse, ax - 12*pulseScale, ay - 12*pulseScale, 24*pulseScale, 24*pulseScale);
           } else if (ach.status === 'completed') {
             // Completed achievement with gold glow
             ctx.shadowColor = '#ffd700';
             ctx.shadowBlur = 6;
             ctx.drawImage(assets.node, ax - achievementSize/2, ay - achievementSize/2, achievementSize, achievementSize);
             
             // Completion ring
             ctx.beginPath();
             ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
             ctx.lineWidth = 2 / camera.scale;
             ctx.arc(ax, ay, 15, 0, Math.PI*2);
             ctx.stroke();
           } else {
             // Locked achievement
             ctx.shadowColor = '#666';
             ctx.shadowBlur = 3;
             ctx.drawImage(assets.lock, ax - achievementSize/2, ay - achievementSize/2, achievementSize, achievementSize);
           }
           ctx.restore();

           // Enhanced hover highlight
           if (hovered && hovered.type === 'achievement' && hovered.core === i && hovered.tier === j && hovered.ach === k) {
             ctx.beginPath();
             ctx.strokeStyle = `rgba(0, 212, 255, ${0.9 + Math.sin(time*8) * 0.1})`;
             ctx.lineWidth = 3 / camera.scale;
             ctx.arc(ax, ay, 18, 0, Math.PI*2); 
             ctx.stroke();
             
             // Scanning effect
             ctx.beginPath();
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
             ctx.lineWidth = 1 / camera.scale;
             ctx.arc(ax, ay, 12 + Math.sin(time*6) * 8, 0, Math.PI*2);
             ctx.stroke();
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

// -- Input handling with enhanced feedback --
let isDragging = false;
let startX = 0, startY = 0;
let dragCamX = 0, dragCamY = 0;

canvas.addEventListener('mousedown', e => {
 isDragging = true;
 startX = e.clientX;
 startY = e.clientY;
 dragCamX = targetCamera.x;
 dragCamY = targetCamera.y;
 canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mouseup', e => {
 isDragging = false;
 canvas.style.cursor = 'default';
 // interpret click if mouse didn't move much
 if (Math.hypot(e.clientX - startX, e.clientY - startY) < 8) {
   if (hovered) handleClick(hovered);
 }
});

canvas.addEventListener('mouseleave', () => {
 isDragging = false;
 canvas.style.cursor = 'default';
 setHovered(null);
});

canvas.addEventListener('mousemove', e => {
 if (isDragging) {
   const dx = (e.clientX - startX) / camera.scale;
   const dy = (e.clientY - startY) / camera.scale;
   targetCamera.x = dragCamX + dx;
   targetCamera.y = dragCamY + dy;
   return;
 }
 // compute world coords
 const mx = (e.clientX - width/2) / camera.scale - camera.x;
 const my = (e.clientY - height/2) / camera.scale - camera.y;
 const newHover = detectHover(mx, my);
 setHovered(newHover);
 // position hoverInfo near cursor
 hoverInfo.style.left = Math.min(e.clientX + 20, width - 320) + 'px';
 hoverInfo.style.top = Math.min(e.clientY + 20, height - 200) + 'px';
});

canvas.addEventListener('wheel', e => {
 const delta = -e.deltaY * 0.0015;
 targetCamera.scale = Math.max(0.2, Math.min(6, targetCamera.scale + delta));
 playWarframeSound('zoom');
});

// Touch support
canvas.addEventListener('touchstart', e => {
 if (e.touches.length === 1) {
   isDragging = true;
   startX = e.touches[0].clientX;
   startY = e.touches[0].clientY;
   dragCamX = targetCamera.x;
   dragCamY = targetCamera.y;
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

// Detect hover with improved precision
function detectHover(mx, my) {
 if (!achievements.planets) return null;
 
 for (let i = 0; i < achievements.planets.length; i++) {
   const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
   const px = Math.cos(angle) * coreRadius;
   const py = Math.sin(angle) * coreRadius;
   
   if (distance(mx, my, px, py) < planetSize * 0.7) {
     return { type: 'core', index: i };
   }

   const planet = achievements.planets[i];
   for (let j = 0; j < planet.tiers.length; j++) {
     const tangle = j * (2 * Math.PI / planet.tiers.length);
     const tx = px + Math.cos(tangle) * tierRadius;
     const ty = py + Math.sin(tangle) * tierRadius;
     
     if (distance(mx, my, tx, ty) < tierSize * 0.8) {
       return { type: 'tier', core: i, tier: j };
     }

     // Check achievements when tier is focused
     if (focusedCore === i && focusedTier === j) {
       const tier = planet.tiers[j];
       for (let k = 0; k < tier.achievements.length; k++) {
         const aangle = k * (2 * Math.PI / tier.achievements.length);
         const ax = tx + Math.cos(aangle) * 55;
         const ay = ty + Math.sin(aangle) * 55;
         if (distance(mx, my, ax, ay) < 15) {
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
   hoverInfo.setAttribute('aria-hidden','true');
   return;
 }
 hoverInfo.classList.add('show');
 hoverInfo.setAttribute('aria-hidden','false');

 // Enhanced hover content with Warframe styling
 if (h.type === 'core') {
   const p = achievements.planets[h.index];
   hoverInfo.querySelector('.hi-title').innerText = (p.planetName || `SECTOR ${h.index+1}`).toUpperCase();
   
   let resHtml = '';
   if (p.resources && p.resources.length) {
     resHtml = '<div style="color: #00d4ff; font-weight: bold; margin-bottom: 6px;">AVAILABLE RESOURCES</div>';
     resHtml += p.resources.slice(0,5).map(r => `<div style="color: #a8b5c8;">▶ ${r}</div>`).join('');
   } else {
     resHtml = '<div style="color: #6b7a8f;"><em>SCANNING FOR RESOURCES...</em></div>';
   }
   hoverInfo.querySelector('.hi-resources').innerHTML = resHtml;
   playWarframeSound('hover');
 } else if (h.type === 'tier') {
   const p = achievements.planets[h.core];
   const t = p.tiers[h.tier];
   hoverInfo.querySelector('.hi-title').innerText = `${t.tierName || `TIER ${h.tier + 1}`}`.toUpperCase();
   
   const completedCount = t.achievements.filter(a => a.status === 'completed').length;
   const totalCount = t.achievements.length;
   const progressPct = Math.round((completedCount / totalCount) * 100);
   
   hoverInfo.querySelector('.hi-resources').innerHTML = 
     `<div style="color: #00d4ff;">MISSION PROGRESS: ${completedCount}/${totalCount} (${progressPct}%)</div>
      <div style="color: #a8b5c8; margin-top: 4px;">CLICK TO ACCESS TIER</div>`;
   playWarframeSound('hover');
 } else if (h.type === 'achievement') {
   const a = achievements.planets[h.core].tiers[h.tier].achievements[h.ach];
   hoverInfo.querySelector('.hi-title').innerText = a.title.toUpperCase();
   
   let statusColor = '#6b7a8f';
   let statusText = 'LOCKED';
   if (a.status === 'available') {
     statusColor = '#00ff88';
     statusText = 'AVAILABLE';
   } else if (a.status === 'completed') {
     statusColor = '#ffd700';
     statusText = 'COMPLETED';
   }
   
   hoverInfo.querySelector('.hi-resources').innerHTML = 
     `<div style="color: #a8b5c8; margin-bottom: 6px;">${a.description || 'Mission briefing classified'}</div>
      <div style="color: ${statusColor}; font-weight: bold;">STATUS: ${statusText}</div>`;
   playWarframeSound('hover');
 }
}

// Enhanced click handling with animations
function handleClick(hit) {
 if (!hit) return;
 
 if (hit.type === 'core') {
   const i = hit.index;
   const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
   targetCamera.x = -Math.cos(angle) * coreRadius;
   targetCamera.y = -Math.sin(angle) * coreRadius;
   targetCamera.scale = 1.8;
   focusedCore = i;
   focusedTier = null;
   populateSidePanelForPlanet(i);
   playWarframeSound('zoom');
 } else if (hit.type === 'tier') {
   const i = hit.core, j = hit.tier;
   const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
   const px = Math.cos(angle) * coreRadius;
   const py = Math.sin(angle) * coreRadius;
   const tangle = j * (2 * Math.PI / achievements.planets[i].tiers.length);
   const tx = px + Math.cos(tangle) * tierRadius;
   const ty = py + Math.sin(tangle) * tierRadius;
   targetCamera.x = -tx;
   targetCamera.y = -ty;
   targetCamera.scale = 3.6;
   focusedCore = i; 
   focusedTier = j;
   populateSidePanelForTier(i, j);
   playWarframeSound('zoom');
 } else if (hit.type === 'achievement') {
   const { core, tier, ach } = hit;
   showAchievementPopup(core, tier, ach);
   playWarframeSound('hover');
 }
}

// Enhanced achievement popup with Warframe styling
function showAchievementPopup(core, tier, k) {
 const a = achievements.planets[core].tiers[tier].achievements[k];
 const planet = achievements.planets[core];
 const tierObj = planet.tiers[tier];
 
 let statusColor = '#6b7a8f';
 let statusIcon = '🔒';
 if (a.status === 'available') {
   statusColor = '#00ff88';
   statusIcon = '⚡';
 } else if (a.status === 'completed') {
   statusColor = '#ffd700';
   statusIcon = '✓';
 }
 
 const content = document.createElement('div');
 content.innerHTML = `
   <div class="panel-corner tl"></div>
   <div class="panel-corner tr"></div>
   <div class="panel-corner bl"></div>
   <div class="panel-corner br"></div>
   <div style="display: flex; align-items: center; margin-bottom: 16px;">
     <div style="font-size: 24px; margin-right: 12px;">${statusIcon}</div>
     <div>
       <h2 style="margin: 0; font-family: 'Orbitron', monospace; color: #00d4ff; text-transform: uppercase;">${a.title}</h2>
       <div style="color: #6b7a8f; font-size: 12px; text-transform: uppercase;">${planet.planetName} • ${tierObj.tierName}</div>
     </div>
   </div>
   <div style="background: rgba(255,255,255,0.05); padding: 12px; border-left: 3px solid #00d4ff; margin-bottom: 16px;">
     <div style="color: #a8b5c8; line-height: 1.4;">${a.description || 'Mission briefing classified. Access terminal for details.'}</div>
   </div>
   <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
     <div>
       <strong style="color: ${statusColor};">STATUS: ${a.status.toUpperCase()}</strong>
       ${a.dateCompleted ? `
${a.dateCompleted ? `<div style="color: #6b7a8f; font-size: 12px; margin-top: 4px;">COMPLETED: ${new Date(a.dateCompleted).toLocaleDateString()}</div>` : ''}
     </div>
     ${a.status === 'available' ? '<div style="color: #00ff88; font-size: 12px;">READY FOR DEPLOYMENT</div>' : ''}
   </div>
   <div style="display: flex; gap: 12px; justify-content: flex-end;">
     ${a.status !== 'completed' && a.status === 'available' ? `<button id="compBtn" class="warframe-btn primary">COMPLETE MISSION</button>` : ''}
     <button id="closeBtn" class="warframe-btn secondary">CLOSE</button>
   </div>`;
 
 popup.innerHTML = '';
 popup.appendChild(content);
 popup.style.display = 'block';

 document.getElementById('closeBtn').addEventListener('click', () => {
   popup.style.display = 'none';
   playWarframeSound('hover');
 });
 
 const compBtn = document.getElementById('compBtn');
 if (compBtn) {
   compBtn.addEventListener('click', () => {
     completeAchievement(core, tier, k);
     popup.style.display = 'none';
     populateSidePanelForTier(core, tier);
     playWarframeSound('hover');
   });
 }
}

// Enhanced side panel population with Warframe theming
function populateSidePanelForPlanet(i) {
 const p = achievements.planets[i];
 if (!p) return;
 
 document.getElementById('sideTitle').innerText = 'PLANETARY DATA';
 document.getElementById('planetName').innerText = (p.planetName || `SECTOR ${i+1}`).toUpperCase();
 
 const totalAchievements = p.tiers.reduce((s,t)=>s+t.achievements.length,0);
 const completedAchievements = p.tiers.reduce((s,t)=>s+t.achievements.filter(a=>a.status==='completed').length,0);
 const progressPct = Math.round((completedAchievements / totalAchievements) * 100);
 
 planetMetaEl.innerHTML = `
   <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
     <span>MISSION TIERS: ${p.tiers.length}</span>
     <span>PROGRESS: ${progressPct}%</span>
   </div>
   <div style="background: rgba(255,255,255,0.1); height: 4px; border-radius: 2px; overflow: hidden;">
     <div style="background: linear-gradient(90deg, #00d4ff, #00ff88); height: 100%; width: ${progressPct}%; transition: width 0.5s ease;"></div>
   </div>`;
 
 document.getElementById('planetSummary').classList.remove('hidden');
 tiersSection.classList.remove('hidden');
 junctionSection.classList.remove('hidden');
 
 // Enhanced tiers list
 tiersList.innerHTML = '';
 p.tiers.forEach((t, j) => {
   const tierCompleted = t.achievements.filter(a => a.status === 'completed').length;
   const tierTotal = t.achievements.length;
   const tierProgress = Math.round((tierCompleted / tierTotal) * 100);
   
   const card = document.createElement('div');
   card.className = 'tier-card';
   
   let tierStatus = 'LOCKED';
   let statusColor = '#6b7a8f';
   if (tierCompleted === tierTotal) {
     tierStatus = 'MASTERED';
     statusColor = '#ffd700';
   } else if (tierCompleted > 0) {
     tierStatus = 'IN PROGRESS';
     statusColor = '#00d4ff';
   } else if (t.achievements.some(a => a.status === 'available')) {
     tierStatus = 'AVAILABLE';
     statusColor = '#00ff88';
   }
   
   card.innerHTML = `
     <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
       <div>
         <div class="tier-title">${(t.tierName || `TIER ${j+1}`).toUpperCase()}</div>
         <div class="tier-desc">${tierCompleted}/${tierTotal} MISSIONS • ${tierProgress}% COMPLETE</div>
       </div>
       <div style="color: ${statusColor}; font-size: 10px; font-weight: bold; padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
         ${tierStatus}
       </div>
     </div>
     <div style="background: rgba(255,255,255,0.05); height: 3px; border-radius: 1px; overflow: hidden; margin-bottom: 12px;">
       <div style="background: linear-gradient(90deg, #00d4ff, #00ff88); height: 100%; width: ${tierProgress}%; transition: width 0.3s ease;"></div>
     </div>
     <div class="tier-achievements" style="margin-bottom: 12px;"></div>
     <div style="display: flex; gap: 8px;">
       <button class="warframe-btn" onclick="focusTier(${i}, ${j})">ACCESS TIER</button>
       <button class="warframe-btn secondary" onclick="showTierDetails(${i}, ${j})">DETAILS</button>
     </div>`;
   
   const achWrap = card.querySelector('.tier-achievements');
   t.achievements.slice(0, 6).forEach((a, k) => {
     const pill = document.createElement('div');
     pill.className = 'ach-pill';
     
     let pillColor = '#6b7a8f';
     let pillIcon = '🔒';
     if (a.status === 'available') {
       pillColor = '#00ff88';
       pillIcon = '⚡';
     } else if (a.status === 'completed') {
       pillColor = '#ffd700';
       pillIcon = '✓';
     }
     
     pill.innerHTML = `<span style="margin-right: 6px;">${pillIcon}</span>${a.title}`;
     pill.style.borderColor = pillColor;
     pill.onclick = () => { focusedCore = i; focusedTier = j; populateSidePanelForTier(i, j); };
     achWrap.appendChild(pill);
   });
   
   if (t.achievements.length > 6) {
     const morePill = document.createElement('div');
     morePill.className = 'ach-pill';
     morePill.innerHTML = `+${t.achievements.length - 6} MORE`;
     morePill.style.opacity = '0.7';
     achWrap.appendChild(morePill);
   }
   
   tiersList.appendChild(card);
 });

 // Enhanced junction section
 junctionList.innerHTML = '';
 if (p.junction && p.junction.tasks && p.junction.tasks.length) {
   p.junction.tasks.forEach(task => {
     const node = document.createElement('div');
     node.className = 'junction-task';
     node.innerHTML = `<div style="display: flex; align-items: center;"><span style="color: #ffd700; margin-right: 8px;">⚡</span>${task}</div>`;
     junctionList.appendChild(node);
   });
 } else {
   const fallback = document.createElement('div');
   fallback.className = 'junction-task';
   fallback.innerHTML = `
     <div style="color: #00d4ff; font-weight: bold; margin-bottom: 8px;">JUNCTION REQUIREMENTS</div>
     <div style="color: #a8b5c8; font-size: 13px;">Complete tier missions to unlock junction passages to new sectors.</div>
     <div style="margin-top: 12px;">
       <button class="warframe-btn" onclick="showJunctionModal('${p.planetName}', ${JSON.stringify(p.tiers[0]).replace(/"/g, '&quot;')})">VIEW REQUIREMENTS</button>
     </div>`;
   junctionList.appendChild(fallback);
 }
}

// Enhanced tier-specific panel
function populateSidePanelForTier(coreIndex, tierIndex) {
 const p = achievements.planets[coreIndex];
 if (!p) return;
 const t = p.tiers[tierIndex];
 
 document.getElementById('sideTitle').innerText = 'MISSION CONTROL';
 document.getElementById('planetName').innerText = `${(p.planetName || `SECTOR ${coreIndex+1}`)} • ${(t.tierName || `TIER ${tierIndex+1}`)}`.toUpperCase();
 
 const completed = t.achievements.filter(a => a.status === 'completed').length;
 const available = t.achievements.filter(a => a.status === 'available').length;
 const locked = t.achievements.filter(a => a.status === 'locked').length;
 
 planetMetaEl.innerHTML = `
   <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
     <div style="text-align: center; padding: 8px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3);">
       <div style="color: #ffd700; font-weight: bold;">${completed}</div>
       <div style="color: #a8b5c8; font-size: 11px;">COMPLETED</div>
     </div>
     <div style="text-align: center; padding: 8px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3);">
       <div style="color: #00ff88; font-weight: bold;">${available}</div>
       <div style="color: #a8b5c8; font-size: 11px;">AVAILABLE</div>
     </div>
     <div style="text-align: center; padding: 8px; background: rgba(107,122,143,0.1); border: 1px solid rgba(107,122,143,0.3);">
       <div style="color: #6b7a8f; font-weight: bold;">${locked}</div>
       <div style="color: #a8b5c8; font-size: 11px;">LOCKED</div>
     </div>
   </div>`;

 // Mission list
 tiersList.innerHTML = '';
 const missionList = document.createElement('div');
 missionList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
 
 t.achievements.forEach((a, k) => {
   const mission = document.createElement('div');
   mission.className = 'tier-card';
   mission.style.padding = '12px';
   
   let statusColor = '#6b7a8f';
   let statusIcon = '🔒';
   let statusText = 'LOCKED';
   if (a.status === 'available') {
     statusColor = '#00ff88';
     statusIcon = '⚡';
     statusText = 'READY';
   } else if (a.status === 'completed') {
     statusColor = '#ffd700';
     statusIcon = '✓';
     statusText = 'COMPLETE';
   }
   
   mission.innerHTML = `
     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
       <div style="display: flex; align-items: center;">
         <span style="font-size: 16px; margin-right: 10px;">${statusIcon}</span>
         <div>
           <div style="color: #fff; font-weight: bold;">${a.title.toUpperCase()}</div>
           <div style="color: #a8b5c8; font-size: 12px;">${a.description || 'Mission briefing classified'}</div>
         </div>
       </div>
       <div style="color: ${statusColor}; font-size: 10px; font-weight: bold; padding: 4px 8px; background: rgba(255,255,255,0.05);">
         ${statusText}
       </div>
     </div>
     ${a.status === 'available' ? `<button class="warframe-btn" style="width: 100%;" onclick="showAchievementPopup(${coreIndex}, ${tierIndex}, ${k})">START MISSION</button>` : ''}
     ${a.status === 'completed' && a.dateCompleted ? `<div style="color: #6b7a8f; font-size: 11px; margin-top: 8px;">COMPLETED: ${new Date(a.dateCompleted).toLocaleDateString()}</div>` : ''}`;
   
   missionList.appendChild(mission);
 });
 
 tiersList.appendChild(missionList);

 // Enhanced junction info
 junctionList.innerHTML = '';
 const junctionInfo = document.createElement('div');
 junctionInfo.className = 'junction-task';
 junctionInfo.innerHTML = `
   <div style="color: #ffd700; font-weight: bold; margin-bottom: 8px;">TIER PROGRESSION</div>
   <div style="color: #a8b5c8; font-size: 13px; margin-bottom: 12px;">
     Complete all missions in this tier to unlock the next tier and gain access to advanced equipment.
   </div>
   <div style="display: flex; gap: 8px;">
     <button class="warframe-btn" onclick="showJunctionModal('${p.planetName}', ${JSON.stringify(t).replace(/"/g, '&quot;')})">VIEW REWARDS</button>
     ${tierIndex > 0 ? `<button class="warframe-btn secondary" onclick="focusTier(${coreIndex}, ${tierIndex-1})">PREV TIER</button>` : ''}
     ${tierIndex < p.tiers.length-1 ? `<button class="warframe-btn secondary" onclick="focusTier(${coreIndex}, ${tierIndex+1})">NEXT TIER</button>` : ''}
   </div>`;
 junctionList.appendChild(junctionInfo);
}

// Global functions for UI interactions
window.focusTier = (coreIndex, tierIndex) => {
 const i = coreIndex, j = tierIndex;
 const angle = i * (2 * Math.PI / achievements.planets.length) - Math.PI/2;
 const px = Math.cos(angle) * coreRadius;
 const py = Math.sin(angle) * coreRadius;
 const tangle = j * (2 * Math.PI / achievements.planets[i].tiers.length);
 const tx = px + Math.cos(tangle) * tierRadius;
 const ty = py + Math.sin(tangle) * tierRadius;
 targetCamera.x = -tx;
 targetCamera.y = -ty;
 targetCamera.scale = 3.8;
 focusedCore = i; 
 focusedTier = j;
 populateSidePanelForTier(i, j);
 playWarframeSound('zoom');
};

window.showTierDetails = (coreIndex, tierIndex) => {
 focusTier(coreIndex, tierIndex);
};

// Enhanced junction modal
function showJunctionModal(planetName, tierObj) {
 junctionModal.style.display = 'flex';
 document.getElementById('junctionTitle').innerText = `${planetName.toUpperCase()} • JUNCTION PROTOCOL`;
 
 const tasksContainer = document.getElementById('junctionTasks');
 tasksContainer.innerHTML = '';
 
 if (typeof tierObj === 'string') {
   tierObj = JSON.parse(tierObj);
 }
 
 if (tierObj.achievements && tierObj.achievements.length) {
   const header = document.createElement('div');
   header.innerHTML = `
     <div style="color: #00d4ff; font-weight: bold; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
       MISSION REQUIREMENTS
     </div>`;
   tasksContainer.appendChild(header);
   
   tierObj.achievements.forEach((a, idx) => {
     const task = document.createElement('div');
     task.className = 'junction-task';
     task.style.marginBottom = '8px';
     
     let statusIcon = '🔒';
     let statusColor = '#6b7a8f';
     if (a.status === 'available') {
       statusIcon = '⚡';
       statusColor = '#00ff88';
     } else if (a.status === 'completed') {
       statusIcon = '✓';
       statusColor = '#ffd700';
     }
     
     task.innerHTML = `
       <div style="display: flex; align-items: center; gap: 12px;">
         <span style="font-size: 18px;">${statusIcon}</span>
         <div style="flex: 1;">
           <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 4px;">${a.title.toUpperCase()}</div>
           <div style="color: #a8b5c8; font-size: 12px;">${a.description || 'Complete this mission to progress'}</div>
         </div>
       </div>`;
     tasksContainer.appendChild(task);
   });
 } else {
   tasksContainer.innerHTML = `
     <div class="junction-task">
       <div style="color: #00d4ff; font-weight: bold; margin-bottom: 8px;">NO SPECIFIC TASKS FOUND</div>
       <div style="color: #a8b5c8;">Junction requirements will be updated as missions become available.</div>
     </div>`;
 }
}

// Utility functions
function distance(ax, ay, bx, by) { 
 return Math.hypot(ax - bx, ay - by); 
}

// Enhanced achievement completion with effects
window.completeAchievement = (core, tier, ach) => {
 const a = achievements.planets[core].tiers[tier].achievements[ach];
 if (!a || a.status === 'completed') return;
 
 a.status = 'completed';
 a.dateCompleted = new Date().toISOString();
 localStorage.setItem('progress', JSON.stringify(achievements));
 
 // Unlock logic
 const currentTier = achievements.planets[core].tiers[tier];
 const allCompleted = currentTier.achievements.every(x => x.status === 'completed');
 
 if (allCompleted && tier < achievements.planets[core].tiers.length - 1) {
   const nextTier = achievements.planets[core].tiers[tier + 1];
   nextTier.achievements.forEach(x => {
     if (x.status === 'locked') x.status = 'available';
   });
 }
 
 // Show completion effect (could be enhanced with particles)
 showCompletionEffect();
 playWarframeSound('hover');
 
 // Refresh UI
 if (focusedCore === core && focusedTier === tier) {
   populateSidePanelForTier(core, tier);
 }
};

function showCompletionEffect() {
 // Simple completion notification
 const notification = document.createElement('div');
 notification.style.cssText = `
   position: fixed;
   top: 100px;
   right: 50%;
   transform: translateX(50%);
   background: linear-gradient(135deg, rgba(0,255,136,0.9), rgba(0,212,255,0.9));
   color: #000;
   padding: 12px 24px;
   font-family: 'Orbitron', monospace;
   font-weight: 700;
   text-transform: uppercase;
   z-index: 1000;
   animation: slideInOut 3s ease-in-out;
 `;
 notification.textContent = 'MISSION COMPLETE';
 document.body.appendChild(notification);
 
 setTimeout(() => {
   if (notification.parentNode) {
     notification.parentNode.removeChild(notification);
   }
 }, 3000);
}

// Add completion animation CSS
const style = document.createElement('style');
style.textContent = `
 @keyframes slideInOut {
   0% { transform: translateX(50%) translateY(-50px); opacity: 0; }
   20% { transform: translateX(50%) translateY(0); opacity: 1; }
   80% { transform: translateX(50%) translateY(0); opacity: 1; }
   100% { transform: translateX(50%) translateY(-50px); opacity: 0; }
 }
`;
document.head.appendChild(style);

// Admin functions (enhanced with Warframe styling)
const adminPanel = document.getElementById('adminPanel');
const editContent = document.getElementById('editContent');

window.showAdminPanel = () => { 
 adminPanel.style.display = 'block';
 playWarframeSound('hover');
};

window.closeAdmin = () => { 
 adminPanel.style.display = 'none'; 
 editContent.style.display = 'none';
 playWarframeSound('hover');
};

window.loginAdmin = () => {
 if (document.getElementById('adminPassword').value === 'admin') {
   let html = '<div style="color: #00d4ff; font-weight: bold; margin-bottom: 16px;">ADMINISTRATOR CONSOLE</div>';
   
   achievements.planets.forEach((p, i) => {
     html += `<div style="background: rgba(255,255,255,0.05); padding: 12px; margin-bottom: 12px; border-left: 3px solid #00d4ff;">`;
     html += `<h3 style="margin: 0 0 12px 0; color: #00d4ff; text-transform: uppercase;">${p.planetName}</h3>`;
     
     p.tiers.forEach((t, j) => {
       html += `<h4 style="color: #ffd700; margin: 8px 0;">${t.tierName}</h4>`;
       t.achievements.forEach((a, k) => {
         html += `<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.03);">
           <input style="flex:1; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;" type="text" value="${escapeHtml(a.title)}" onchange="editTitle(${i},${j},${k},this.value)" />
           <input style="flex:2; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;" type="text" value="${escapeHtml(a.description||'')}" onchange="editDesc(${i},${j},${k},this.value)" />
           <select style="padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;" onchange="editStatus(${i},${j},${k},this.value)">
             <option${a.status==='locked'?' selected':''}>locked</option>
             <option${a.status==='available'?' selected':''}>available</option>
             <option${a.status==='completed'?' selected':''}>completed</option>
           </select>
         </div>`;
       });
     });
     html += `</div>`;
   });
   
   html += `<div style="margin-top: 20px; display: flex; gap: 12px;">
     <button class="warframe-btn primary" onclick="downloadJson()">EXPORT DATA</button>
     <button class="warframe-btn" onclick="bulkUnlock()">UNLOCK ALL</button>
     <button class="warframe-btn secondary" onclick="bulkReset()">RESET ALL</button>
   </div>`;
   
   editContent.innerHTML = html;
   editContent.style.display = 'block';
   document.getElementById('adminPassword').style.display = 'none';
 } else {
   alert('ACCESS DENIED');
 }
};

function escapeHtml(s){ 
 return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}

window.editTitle = (i,j,k,value) => { 
 achievements.planets[i].tiers[j].achievements[k].title = value; 
};

window.editDesc = (i,j,k,value) => { 
 achievements.planets[i].tiers[j].achievements[k].description = value; 
};

window.editStatus = (i,j,k,value) => {
 const a = achievements.planets[i].tiers[j].achievements[k];
 a.status = value;
 a.dateCompleted = value === 'completed' ? new Date().toISOString() : null;
};

window.downloadJson = () => {
 const blob = new Blob([JSON.stringify(achievements, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a'); 
 a.href = url; 
 a.download = 'warframe-achievements.json'; 
 a.click();
 playWarframeSound('hover');
};

window.bulkUnlock = () => {
 achievements.planets.forEach(p => p.tiers.forEach(t => t.achievements.forEach(a => a.status = 'available')));
 alert('ALL MISSIONS UNLOCKED');
 playWarframeSound('hover');
};

window.bulkReset = () => {
 achievements.planets.forEach(p => p.tiers.forEach((t,j) => t.achievements.forEach(a => {
   a.status = j === 0 ? 'available' : 'locked';
   a.dateCompleted = null;
 })));
 alert('ALL PROGRESS RESET');
 playWarframeSound('hover');
};
