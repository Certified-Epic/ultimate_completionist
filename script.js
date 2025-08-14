const canvas = document.getElementById('starChart');
const ctx = canvas.getContext('2d');
let width, height;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();
const colors = {
  background: 'black',
  stars: 'white',
  line: 'white',
  text: 'white',
  glow: 'white',
  pulse: 'rgba(255,255,255,0.5)',
  ring: 'white' // Customize here: change values to hex or rgba for different themes, e.g., text: '#00ff00' for green
};
const assets = {
  center: new Image(),
  planet: new Image(),
  lock: new Image(),
  pulse: new Image(),
  node: new Image(),
  junction: new Image(),
};
assets.center.src = './assets/center.png';
assets.planet.src = './assets/planet.png';
assets.lock.src = './assets/lock.png';
assets.pulse.src = './assets/pulse.png';
assets.node.src = './assets/node.png';
assets.junction.src = './assets/junction.png';
const sounds = {
  hover: new Audio('./assets/hover.mp3'),
  zoom: new Audio('./assets/zoom.mp3'),
  background: new Audio('./assets/background.mp3'),
};
sounds.background.loop = true;
sounds.background.volume = 0.5;
sounds.background.play();
let achievements = {};
fetch('./achievements.json')
  .then(response => response.json())
  .then(data => {
    achievements = data;
    const saved = localStorage.getItem('progress');
    if (saved) {
      const progress = JSON.parse(saved);
      progress.planets.forEach((p, i) => {
        p.tiers.forEach((t, j) => {
          t.achievements.forEach((a, k) => {
            achievements.planets[i].tiers[j].achievements[k].status = a.status;
            achievements.planets[i].tiers[j].achievements[k].dateCompleted = a.dateCompleted;
          });
        });
      });
    }
  });
let camera = { x: 0, y: 0, scale: 0.5 };
let targetCamera = { x: 0, y: 0, scale: 0.5 };
let easing = 0.1;
let focusedPlanet = null;
let hovered = null;
const coreRadius = 800; // Increased for better orbit spacing
const tierRadius = 200; // Adjusted for better layout
const planetSize = 80; // Increased size for planets
const tierSize = 40; // Increased size for nodes
const achievementSize = 15; // Increased size for sub-items
let starParticles = [];
for (let i = 0; i < 200; i++) {
  starParticles.push({
    x: Math.random() * 2000 - 1000,
    y: Math.random() * 2000 - 1000,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 0.5 + 0.5,
  });
}
let time = 0;
let mouse = { x: 0, y: 0 };
let worldMouse = { x: 0, y: 0 };
function getWorldPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - width / 2) / camera.scale - camera.x;
  const y = (clientY - rect.top - height / 2) / camera.scale - camera.y;
  return { x, y };
}
function draw() {
  time += 0.016;
  camera.x += (targetCamera.x - camera.x) * easing;
  camera.y += (targetCamera.y - camera.y) * easing;
  camera.scale += (targetCamera.scale - camera.scale) * easing;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2 + camera.x * camera.scale, height / 2 + camera.y * camera.scale);
  ctx.scale(camera.scale, camera.scale);
  // Starfield
  ctx.fillStyle = colors.stars;
  for (let p of starParticles) {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    p.x -= p.speed * 0.1;
    if (p.x < -1000) p.x = 1000;
  }
  ctx.globalAlpha = 1;
  // Central image (made bigger)
  ctx.drawImage(assets.center, -100, -100, 200, 200);
  if (achievements.planets) {
    achievements.planets.forEach((planet, i) => {
      const angle = i * (Math.PI * 2 / achievements.planets.length); // Dynamic based on number of planets for better orbit
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;
      // Orbital rings for core
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1 / camera.scale;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(px, py, tierRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, tierRadius + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Core planet
      ctx.drawImage(assets.planet, px - planetSize / 2, py - planetSize / 2, planetSize, planetSize);
      // Label
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.font = '12px Arial';
      ctx.fillText(planet.name || 'Planet', px, py + planetSize / 2 + 15);
      // Draw tiers/nodes with connections
      planet.tiers.forEach((tier, j) => {
        const tAngle = j * (Math.PI * 2 / planet.tiers.length) + Math.random() * 0.2 - 0.1; // Slight random offset for natural layout
        const tDist = tierRadius + Math.random() * 50 - 25; // Vary distance for better structure
        const tx = px + Math.cos(tAngle) * tDist;
        const ty = py + Math.sin(tAngle) * tDist;
        // Connection line
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        // Node image
        ctx.drawImage(assets.node, tx - tierSize / 2, ty - tierSize / 2, tierSize, tierSize);
        // Label
        ctx.fillText(tier.name || 'Node', tx, ty + tierSize / 2 + 15);
        if (hovered === tier) {
          // Glow for hologram hover
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 20;
          ctx.drawImage(assets.node, tx - tierSize / 2, ty - tierSize / 2, tierSize, tierSize);
          ctx.shadowBlur = 0;
        }
      });
    });
  }
  ctx.restore();
  // Hologram tooltip if hovered
  if (hovered) {
    ctx.fillStyle = 'rgba(0, 128, 255, 0.7)'; // Blue hologram style
    ctx.fillRect(mouse.x, mouse.y - 120, 220, 100);
    ctx.fillStyle = colors.text;
    ctx.font = '14px Arial';
    ctx.fillText(hovered.name || 'Item', mouse.x + 10, mouse.y - 90);
    ctx.font = '12px Arial';
    ctx.fillText('Details: ' + (hovered.description || 'Hover info'), mouse.x + 10, mouse.y - 70);
  }
}
function animate() {
  draw();
  requestAnimationFrame(animate);
}
animate();
// Event listeners
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  worldMouse = getWorldPos(e.clientX, e.clientY);
  hovered = null;
  if (achievements.planets) {
    for (let i = 0; i < achievements.planets.length; i++) {
      const planet = achievements.planets[i];
      const angle = i * (Math.PI * 2 / achievements.planets.length);
      const px = Math.cos(angle) * coreRadius;
      const py = Math.sin(angle) * coreRadius;
      const dist = Math.hypot(worldMouse.x - px, worldMouse.y - py);
      if (dist < planetSize / 2) {
        hovered = planet;
        if (!planet.hoveredBefore) {
          sounds.hover.play();
          planet.hoveredBefore = true;
        }
        return;
      }
      planet.hoveredBefore = false;
      for (let j = 0; j < planet.tiers.length; j++) {
        const tier = planet.tiers[j];
        const tAngle = j * (Math.PI * 2 / planet.tiers.length) + Math.random() * 0.2 - 0.1;
        const tDist = tierRadius + Math.random() * 50 - 25;
        const tx = px + Math.cos(tAngle) * tDist;
        const ty = py + Math.sin(tAngle) * tDist;
        const dist = Math.hypot(worldMouse.x - tx, worldMouse.y - ty);
        if (dist < tierSize / 2) {
          hovered = tier;
          if (!tier.hoveredBefore) {
            sounds.hover.play();
            tier.hoveredBefore = true;
          }
          return;
        }
        tier.hoveredBefore = false;
      }
    }
  }
});
canvas.addEventListener('click', (e) => {
  if (hovered && achievements.planets.includes(hovered)) { // Zoom in on planet
    const i = achievements.planets.indexOf(hovered);
    const angle = i * (Math.PI * 2 / achievements.planets.length);
    const px = Math.cos(angle) * coreRadius;
    const py = Math.sin(angle) * coreRadius;
    targetCamera.x = -px;
    targetCamera.y = -py;
    targetCamera.scale = 3; // Zoom to make planet big
    focusedPlanet = hovered;
    sounds.zoom.play();
  } else { // Zoom out
    targetCamera.x = 0;
    targetCamera.y = 0;
    targetCamera.scale = 0.5;
    focusedPlanet = null;
    sounds.zoom.play();
  }
});
canvas.addEventListener('wheel', (e) => {
  targetCamera.scale -= e.deltaY * 0.001;
  targetCamera.scale = Math.max(0.1, Math.min(5, targetCamera.scale));
});
