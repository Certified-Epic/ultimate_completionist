<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Planetary System</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
            font-family: 'Arial', sans-serif;
        }
        #starChart {
            display: block;
            cursor: grab;
        }
        #starChart:active {
            cursor: grabbing;
        }
        .ui-panel {
            position: fixed;
            background: rgba(0, 20, 40, 0.9);
            border: 2px solid #00ffff;
            border-radius: 10px;
            padding: 20px;
            color: #ffffff;
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
            backdrop-filter: blur(10px);
            display: none;
        }
        #achievementPopup {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 400px;
            z-index: 1000;
        }
        #sidePanel {
            top: 20px;
            right: 20px;
            width: 300px;
            max-height: 70vh;
            overflow-y: auto;
            z-index: 999;
        }
        #adminPanel {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 1001;
        }
        .close-btn {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            color: #00ffff;
            font-size: 20px;
            cursor: pointer;
        }
        .task-list {
            list-style: none;
            padding: 0;
        }
        .task-list li {
            padding: 5px 0;
            border-bottom: 1px solid rgba(0, 255, 255, 0.2);
        }
        .task-list li.completed {
            color: #00ff00;
            text-decoration: line-through;
        }
        button {
            background: linear-gradient(45deg, #0066cc, #00ffff);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            transition: all 0.3s ease;
        }
        button:hover {
            transform: scale(1.05);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
        }
        input, select {
            background: rgba(0, 50, 100, 0.8);
            border: 1px solid #00ffff;
            color: white;
            padding: 5px;
            margin: 2px;
            border-radius: 3px;
        }
        .zoom-controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 998;
        }
        .zoom-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: bold;
        }
        .info-display {
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 20, 40, 0.9);
            border: 2px solid #00ffff;
            border-radius: 10px;
            padding: 15px;
            color: #ffffff;
            min-width: 200px;
            z-index: 997;
        }
    </style>
</head>
<body>
    <canvas id="starChart"></canvas>
    
    <div class="info-display">
        <div><strong>Zoom Level:</strong> <span id="zoomLevel">50%</span></div>
        <div><strong>Position:</strong> <span id="position">0, 0</span></div>
        <div><strong>Focused:</strong> <span id="focused">None</span></div>
        <div style="margin-top: 10px; font-size: 12px;">
            <div>• Mouse wheel: Zoom</div>
            <div>• Click & drag: Pan</div>
            <div>• Click planet: Focus</div>
            <div>• Double-click: Reset view</div>
        </div>
    </div>

    <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomIn()">+</button>
        <button class="zoom-btn" onclick="zoomOut()">-</button>
        <button class="zoom-btn" onclick="resetView()" title="Reset View">⌂</button>
    </div>

    <div id="achievementPopup" class="ui-panel">
        <button class="close-btn" onclick="closePopup()">&times;</button>
        <div id="achievementContent"></div>
    </div>

    <div id="sidePanel" class="ui-panel">
        <button class="close-btn" onclick="closeSidePanel()">&times;</button>
        <h3 id="panelTitle">Planet Details</h3>
        <ul id="taskList" class="task-list"></ul>
    </div>

    <div id="adminPanel" class="ui-panel">
        <button class="close-btn" onclick="closeAdminPanel()">&times;</button>
        <h3>Admin Panel</h3>
        <input type="password" id="adminPassword" placeholder="Enter password">
        <button onclick="loginAdmin()">Login</button>
        <div id="editContent" style="display: none;"></div>
    </div>

    <script>
        // Sample data structure - replace with your achievements.json
        const sampleAchievements = {
            planets: [
                {
                    planetName: "URANUS",
                    tiers: [
                        {
                            tierName: "OPHELIA",
                            achievements: [
                                { title: "First Steps", description: "Begin your journey", status: "available" },
                                { title: "Explorer", description: "Discover new areas", status: "locked" }
                            ]
                        },
                        {
                            tierName: "CRESSIDA", 
                            achievements: [
                                { title: "Intermediate", description: "Advanced challenge", status: "locked" }
                            ]
                        }
                    ]
                },
                {
                    planetName: "CAELUS",
                    tiers: [
                        {
                            tierName: "Tier 1",
                            achievements: [
                                { title: "Basic Task", description: "Simple achievement", status: "available" }
                            ]
                        }
                    ]
                },
                {
                    planetName: "ARIEL",
                    tiers: [
                        {
                            tierName: "Wind Tier",
                            achievements: [
                                { title: "Wind Walker", description: "Master the winds", status: "locked" }
                            ]
                        }
                    ]
                },
                {
                    planetName: "DESDEMONA", 
                    tiers: [
                        {
                            tierName: "Shadow Tier",
                            achievements: [
                                { title: "Shadow Master", description: "Control the shadows", status: "locked" }
                            ]
                        }
                    ]
                },
                {
                    planetName: "ROSALIND",
                    tiers: [
                        {
                            tierName: "Rose Tier", 
                            achievements: [
                                { title: "Rose Guardian", description: "Protect the gardens", status: "locked" }
                            ]
                        }
                    ]
                }
            ]
        };

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

        // Enhanced colors with better contrast and sci-fi theme
        const colors = {
            background: '#000811',
            stars: '#ffffff',
            line: '#00aaff',
            text: '#ffffff',
            glow: '#00ffff',
            pulse: 'rgba(0,255,255,0.8)',
            ring: '#00ffff',
            orbitLine: 'rgba(0,170,255,0.3)',
            planetGlow: 'rgba(0,255,255,0.4)',
            centerGlow: 'rgba(255,100,0,0.6)'
        };

        let achievements = sampleAchievements;
        let camera = { x: 0, y: 0, scale: 0.5 };
        let targetCamera = { x: 0, y: 0, scale: 0.5 };
        let easing = 0.08;
        let focusedCore = null;
        let focusedPlanet = null;
        let hovered = null;

        // Enhanced sizing for better visibility
        const centralSize = 120;
        const orbitRadii = [200, 280, 360, 440, 520]; // Fixed orbital distances
        const planetSizes = [45, 40, 35, 30, 25]; // Decreasing sizes by distance
        const tierRadius = 80;
        const tierSize = 25;
        const achievementSize = 12;

        // Enhanced star field
        let starParticles = [];
        for (let i = 0; i < 300; i++) {
            starParticles.push({
                x: (Math.random() - 0.5) * 4000,
                y: (Math.random() - 0.5) * 4000,
                size: Math.random() * 3 + 1,
                alpha: Math.random() * 0.8 + 0.2,
                twinkle: Math.random() * Math.PI * 2
            });
        }

        let time = 0;

        function drawGlow(x, y, radius, color, intensity = 1) {
            ctx.save();
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = intensity;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function drawOrbitRings() {
            ctx.strokeStyle = colors.orbitLine;
            ctx.lineWidth = 1.5 / camera.scale;
            ctx.globalAlpha = 0.4;
            
            orbitRadii.forEach(radius => {
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.globalAlpha = 1;
        }

        function drawCentralBody() {
            // Central glow effect
            drawGlow(0, 0, centralSize * 1.5, colors.centerGlow, 0.6);
            
            // Central body with gradient
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centralSize/2);
            gradient.addColorStop(0, '#ff6600');
            gradient.addColorStop(0.5, '#ff3300');
            gradient.addColorStop(1, '#cc1100');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, centralSize/2, 0, Math.PI * 2);
            ctx.fill();
            
            // Central body border
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2 / camera.scale;
            ctx.stroke();
            
            // Central label
            if (camera.scale > 0.3) {
                ctx.fillStyle = colors.text;
                ctx.font = `bold ${Math.max(12, 16 * camera.scale)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText('CENTRAL CORE', 0, centralSize/2 + 25);
            }
        }

        function updateUI() {
            document.getElementById('zoomLevel').textContent = Math.round(camera.scale * 100) + '%';
            document.getElementById('position').textContent = 
                Math.round(camera.x) + ', ' + Math.round(camera.y);
            
            let focusText = 'None';
            if (focusedCore !== null) {
                focusText = achievements.planets[focusedCore].planetName;
                if (focusedPlanet !== null) {
                    focusText += ' - ' + achievements.planets[focusedCore].tiers[focusedPlanet].tierName;
                }
            }
            document.getElementById('focused').textContent = focusText;
        }

        function draw() {
            time += 0.016;

            // Smooth camera movement
            camera.x += (targetCamera.x - camera.x) * easing;
            camera.y += (targetCamera.y - camera.y) * easing;
            camera.scale += (targetCamera.scale - camera.scale) * easing;

            // Clear and setup
            ctx.fillStyle = colors.background;
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(width / 2 + camera.x * camera.scale, height / 2 + camera.y * camera.scale);
            ctx.scale(camera.scale, camera.scale);

            // Enhanced starfield
            ctx.fillStyle = colors.stars;
            for (let star of starParticles) {
                const twinkle = Math.sin(time + star.twinkle) * 0.3 + 0.7;
                ctx.globalAlpha = star.alpha * twinkle;
                ctx.fillRect(star.x, star.y, star.size, star.size);
            }
            ctx.globalAlpha = 1;

            // Draw orbital rings
            drawOrbitRings();

            // Central body
            drawCentralBody();

            // Draw planets in proper orbits
            if (achievements.planets) {
                achievements.planets.forEach((planet, i) => {
                    if (i >= orbitRadii.length) return;
                    
                    const radius = orbitRadii[i];
                    const planetSize = planetSizes[i];
                    const angle = (time * 0.1 * (1 - i * 0.2)) + i * (Math.PI * 2 / 5); // Different orbital speeds
                    const px = Math.cos(angle) * radius;
                    const py = Math.sin(angle) * radius;

                    // Planet glow
                    drawGlow(px, py, planetSize * 1.2, colors.planetGlow, 0.5);

                    // Planet gradient
                    const planetGradient = ctx.createRadialGradient(px, py, 0, px, py, planetSize/2);
                    planetGradient.addColorStop(0, '#4488ff');
                    planetGradient.addColorStop(0.7, '#2266cc');
                    planetGradient.addColorStop(1, '#114488');
                    
                    ctx.fillStyle = planetGradient;
                    ctx.beginPath();
                    ctx.arc(px, py, planetSize/2, 0, Math.PI * 2);
                    ctx.fill();

                    // Planet border
                    ctx.strokeStyle = colors.line;
                    ctx.lineWidth = 1.5 / camera.scale;
                    ctx.stroke();

                    // Hover effect
                    if (hovered && hovered.type === 'core' && hovered.index === i) {
                        ctx.strokeStyle = colors.ring;
                        ctx.shadowColor = colors.glow;
                        ctx.shadowBlur = 20;
                        let ringAlpha = 0.7 + Math.sin(time * 3) * 0.3;
                        ctx.globalAlpha = ringAlpha;
                        
                        for (let r = 1; r <= 3; r++) {
                            ctx.beginPath();
                            ctx.arc(px, py, planetSize/2 + r * 8, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                        
                        ctx.globalAlpha = 1;
                        ctx.shadowBlur = 0;
                    }

                    // Planet label
                    if (camera.scale > 0.4) {
                        ctx.fillStyle = colors.text;
                        ctx.font = `bold ${Math.max(10, 14 * Math.min(camera.scale, 1))}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.shadowColor = 'black';
                        ctx.shadowBlur = 3;
                        ctx.fillText(planet.planetName, px, py + planetSize/2 + 20);
                        ctx.shadowBlur = 0;
                    }

                    // Draw tier system when focused
                    if (focusedCore === i || (camera.scale > 1.5 && Math.hypot(px - (-camera.x), py - (-camera.y)) < 200)) {
                        planet.tiers.forEach((tier, j) => {
                            const tierAngle = j * (Math.PI * 2 / Math.max(planet.tiers.length, 4)) + time * 0.2;
                            const tx = px + Math.cos(tierAngle) * tierRadius;
            const ty = py + Math.sin(tierAngle) * tierRadius;
            
            targetCamera.x = -tx;
            targetCamera.y = -ty;
            targetCamera.scale = 4;
            focusedCore = coreIndex;
            focusedPlanet = tierIndex;
        }

        function showAchievementPopup(coreIndex, tierIndex, achIndex) {
            const achievement = achievements.planets[coreIndex].tiers[tierIndex].achievements[achIndex];
            const content = `
                <h2>${achievement.title}</h2>
                <p>${achievement.description}</p>
                <p><strong>Status:</strong> <span style="color: ${
                    achievement.status === 'completed' ? '#00ff00' : 
                    achievement.status === 'available' ? '#ffaa00' : '#666666'
                }">${achievement.status.toUpperCase()}</span></p>
                ${achievement.status === 'available' ? 
                    `<button onclick="completeAchievement(${coreIndex}, ${tierIndex}, ${achIndex})">Complete Achievement</button>` : 
                    ''}
                ${achievement.dateCompleted ? 
                    `<p><small>Completed: ${new Date(achievement.dateCompleted).toLocaleDateString()}</small></p>` : 
                    ''}
            `;
            document.getElementById('achievementContent').innerHTML = content;
            document.getElementById('achievementPopup').style.display = 'block';
        }

        function resetView() {
            targetCamera.x = 0;
            targetCamera.y = 0;
            targetCamera.scale = 0.5;
            focusedCore = null;
            focusedPlanet = null;
        }

        function zoomIn() {
            targetCamera.scale = Math.min(10, targetCamera.scale * 1.5);
        }

        function zoomOut() {
            targetCamera.scale = Math.max(0.1, targetCamera.scale / 1.5);
        }

        function closePopup() {
            document.getElementById('achievementPopup').style.display = 'none';
        }

        function closeSidePanel() {
            document.getElementById('sidePanel').style.display = 'none';
        }

        function closeAdminPanel() {
            document.getElementById('adminPanel').style.display = 'none';
        }

        // Achievement completion
        function completeAchievement(core, tier, ach) {
            const achievement = achievements.planets[core].tiers[tier].achievements[ach];
            achievement.status = 'completed';
            achievement.dateCompleted = new Date().toISOString();
            closePopup();
            
            // Check if all achievements in tier are completed
            const allCompleted = achievements.planets[core].tiers[tier].achievements.every(a => a.status === 'completed');
            if (allCompleted && tier < achievements.planets[core].tiers.length - 1) {
                // Unlock next tier
                achievements.planets[core].tiers[tier + 1].achievements.forEach(a => {
                    if (a.status === 'locked') a.status = 'available';
                });
            }
        }

        // Admin functionality
        function loginAdmin() {
            const pass = document.getElementById('adminPassword').value;
            if (pass === 'admin123') {
                let html = '<h4>Achievement Editor</h4>';
                achievements.planets.forEach((p, i) => {
                    html += `<h3>${p.planetName}</h3>`;
                    p.tiers.forEach((t, j) => {
                        html += `<h4>${t.tierName}</h4>`;
                        t.achievements.forEach((a, k) => {
                            html += `
                                <div style="margin: 10px 0; padding: 10px; border: 1px solid #00ffff; border-radius: 5px;">
                                    <input type="text" value="${a.title}" placeholder="Title" 
                                           onchange="editTitle(${i},${j},${k},this.value)" style="width: 200px;">
                                    <br><br>
                                    <input type="text" value="${a.description}" placeholder="Description" 
                                           onchange="editDesc(${i},${j},${k},this.value)" style="width: 300px;">
                                    <br><br>
                                    <select onchange="editStatus(${i},${j},${k},this.value)">
                                        <option value="locked" ${a.status === 'locked' ? 'selected' : ''}>Locked</option>
                                        <option value="available" ${a.status === 'available' ? 'selected' : ''}>Available</option>
                                        <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    </select>
                                </div>
                            `;
                        });
                    });
                });
                html += `
                    <div style="margin-top: 20px;">
                        <button onclick="downloadJson()">Download Configuration</button>
                        <button onclick="bulkUnlock()">Unlock All</button>
                        <button onclick="bulkReset()">Reset All</button>
                    </div>
                `;
                document.getElementById('editContent').innerHTML = html;
                document.getElementById('adminPassword').style.display = 'none';
                document.getElementById('editContent').style.display = 'block';
            } else {
                alert('Incorrect password');
            }
        }

        function editTitle(i, j, k, value) {
            achievements.planets[i].tiers[j].achievements[k].title = value;
        }

        function editDesc(i, j, k, value) {
            achievements.planets[i].tiers[j].achievements[k].description = value;
        }

        function editStatus(i, j, k, value) {
            achievements.planets[i].tiers[j].achievements[k].status = value;
            if (value === 'completed') {
                achievements.planets[i].tiers[j].achievements[k].dateCompleted = new Date().toISOString();
            } else {
                achievements.planets[i].tiers[j].achievements[k].dateCompleted = null;
            }
        }

        function downloadJson() {
            const dataStr = JSON.stringify(achievements, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'achievements.json';
            link.click();
        }

        function bulkUnlock() {
            achievements.planets.forEach(p => {
                p.tiers.forEach(t => {
                    t.achievements.forEach(a => {
                        a.status = 'available';
                    });
                });
            });
            alert('All achievements unlocked');
        }

        function bulkReset() {
            achievements.planets.forEach(p => {
                p.tiers.forEach((t, j) => {
                    t.achievements.forEach(a => {
                        a.status = j === 0 ? 'available' : 'locked';
                        a.dateCompleted = null;
                    });
                });
            });
            alert('All achievements reset');
        }

        // Touch support for mobile
        let touchStartX, touchStartY, touchDistance;
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX - targetCamera.x * targetCamera.scale;
                startY = e.touches[0].clientY - targetCamera.y * targetCamera.scale;
            } else if (e.touches.length === 2) {
                touchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                targetCamera.x = (e.touches[0].clientX - startX) / targetCamera.scale;
                targetCamera.y = (e.touches[0].clientY - startY) / targetCamera.scale;
            } else if (e.touches.length === 2) {
                const newDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (newDistance - touchDistance) / 200;
                targetCamera.scale = Math.max(0.1, Math.min(10, targetCamera.scale + delta));
                touchDistance = newDistance;
            }
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            isDragging = false;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    resetView();
                    break;
                case '+':
                case '=':
                    zoomIn();
                    break;
                case '-':
                    zoomOut();
                    break;
                case 'Escape':
                    closePopup();
                    closeSidePanel();
                    closeAdminPanel();
                    break;
                case 'a':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        document.getElementById('adminPanel').style.display = 'block';
                    }
                    break;
            }
        });

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!document.getElementById('sidePanel').contains(e.target) && 
                !canvas.contains(e.target)) {
                closeSidePanel();
            }
            if (!document.getElementById('achievementPopup').contains(e.target) && 
                !canvas.contains(e.target)) {
                closePopup();
            }
        });

        // Expose functions to global scope for button clicks
        window.zoomIn = zoomIn;
        window.zoomOut = zoomOut;
        window.resetView = resetView;
        window.closePopup = closePopup;
        window.closeSidePanel = closeSidePanel;
        window.closeAdminPanel = closeAdminPanel;
        window.completeAchievement = completeAchievement;
        window.loginAdmin = loginAdmin;
        window.editTitle = editTitle;
        window.editDesc = editDesc;
        window.editStatus = editStatus;
        window.downloadJson = downloadJson;
        window.bulkUnlock = bulkUnlock;
        window.bulkReset = bulkReset;

        // Start the animation
        draw();
    </script>
</body>
</html>;
                            const ty = py + Math.sin(tierAngle) * tierRadius;

                            // Connection line with pulse effect
                            ctx.strokeStyle = colors.pulse;
                            ctx.lineWidth = (2 + Math.sin(time * 2 + j) * 0.5) / camera.scale;
                            ctx.globalAlpha = 0.8;
                            ctx.beginPath();
                            ctx.moveTo(px, py);
                            ctx.lineTo(tx, ty);
                            ctx.stroke();
                            ctx.globalAlpha = 1;

                            // Tier node
                            const tierGradient = ctx.createRadialGradient(tx, ty, 0, tx, ty, tierSize/2);
                            tierGradient.addColorStop(0, '#66aaff');
                            tierGradient.addColorStop(1, '#2255aa');
                            
                            ctx.fillStyle = tierGradient;
                            ctx.beginPath();
                            ctx.arc(tx, ty, tierSize/2, 0, Math.PI * 2);
                            ctx.fill();
                            
                            ctx.strokeStyle = colors.line;
                            ctx.lineWidth = 1 / camera.scale;
                            ctx.stroke();

                            // Tier hover effect
                            if (hovered && hovered.type === 'tier' && hovered.core === i && hovered.tier === j) {
                                ctx.strokeStyle = colors.ring;
                                ctx.shadowColor = colors.glow;
                                ctx.shadowBlur = 15;
                                let ringAlpha = 0.8 + Math.sin(time * 4) * 0.2;
                                ctx.globalAlpha = ringAlpha;
                                
                                ctx.beginPath();
                                ctx.arc(tx, ty, tierSize/2 + 8, 0, Math.PI * 2);
                                ctx.stroke();
                                
                                ctx.globalAlpha = 1;
                                ctx.shadowBlur = 0;
                            }

                            // Tier label
                            if (camera.scale > 1) {
                                ctx.fillStyle = colors.text;
                                ctx.font = `${Math.max(8, 10 * Math.min(camera.scale/2, 1))}px Arial`;
                                ctx.textAlign = 'center';
                                ctx.fillText(tier.tierName, tx, ty + tierSize/2 + 15);
                            }

                            // Achievement nodes if this tier is focused
                            if (focusedCore === i && focusedPlanet === j && tier.achievements) {
                                const achievementRadius = 40;
                                tier.achievements.forEach((ach, k) => {
                                    const achAngle = k * (Math.PI * 2 / tier.achievements.length) + time * 0.1;
                                    const ax = tx + Math.cos(achAngle) * achievementRadius;
                                    const ay = ty + Math.sin(achAngle) * achievementRadius;

                                    // Achievement connection
                                    ctx.strokeStyle = colors.pulse;
                                    ctx.lineWidth = 1 / camera.scale;
                                    ctx.globalAlpha = 0.6;
                                    ctx.beginPath();
                                    ctx.moveTo(tx, ty);
                                    ctx.lineTo(ax, ay);
                                    ctx.stroke();

                                    // Data pulse along line
                                    const pulsePos = (Math.sin(time * 2 + k) + 1) / 2;
                                    const pulseX = tx + (ax - tx) * pulsePos;
                                    const pulseY = ty + (ay - ty) * pulsePos;
                                    ctx.fillStyle = colors.pulse;
                                    ctx.globalAlpha = 0.8;
                                    ctx.beginPath();
                                    ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2);
                                    ctx.fill();
                                    ctx.globalAlpha = 1;

                                    // Achievement node
                                    let nodeColor = '#666666'; // locked
                                    if (ach.status === 'available') nodeColor = '#ffaa00';
                                    if (ach.status === 'completed') nodeColor = '#00ff00';

                                    ctx.fillStyle = nodeColor;
                                    ctx.beginPath();
                                    ctx.arc(ax, ay, achievementSize/2, 0, Math.PI * 2);
                                    ctx.fill();

                                    // Pulse effect for available achievements
                                    if (ach.status === 'available') {
                                        const pulseSize = achievementSize/2 + Math.sin(time * 3 + k) * 2;
                                        ctx.globalAlpha = 0.5 + Math.sin(time * 3 + k) * 0.3;
                                        ctx.strokeStyle = nodeColor;
                                        ctx.lineWidth = 1 / camera.scale;
                                        ctx.beginPath();
                                        ctx.arc(ax, ay, pulseSize, 0, Math.PI * 2);
                                        ctx.stroke();
                                        ctx.globalAlpha = 1;
                                    }

                                    // Achievement hover
                                    if (hovered && hovered.type === 'achievement' && 
                                        hovered.core === i && hovered.tier === j && hovered.ach === k) {
                                        ctx.strokeStyle = colors.glow;
                                        ctx.shadowColor = colors.glow;
                                        ctx.shadowBlur = 10;
                                        ctx.globalAlpha = 0.9;
                                        ctx.beginPath();
                                        ctx.arc(ax, ay, achievementSize/2 + 5, 0, Math.PI * 2);
                                        ctx.stroke();
                                        ctx.globalAlpha = 1;
                                        ctx.shadowBlur = 0;
                                    }
                                });
                            }
                        });
                    }
                });
            }

            ctx.restore();
            updateUI();
            requestAnimationFrame(draw);
        }

        // Enhanced interaction handling
        let isDragging = false;
        let startX, startY;
        let lastClickTime = 0;

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX - targetCamera.x * targetCamera.scale;
            startY = e.clientY - targetCamera.y * targetCamera.scale;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                targetCamera.x = (e.clientX - startX) / targetCamera.scale;
                targetCamera.y = (e.clientY - startY) / targetCamera.scale;
            }

            // Enhanced hover detection
            const mx = (e.clientX - width / 2) / camera.scale - camera.x;
            const my = (e.clientY - height / 2) / camera.scale - camera.y;
            hovered = null;

            if (achievements.planets) {
                achievements.planets.forEach((planet, i) => {
                    if (i >= orbitRadii.length) return;
                    
                    const radius = orbitRadii[i];
                    const planetSize = planetSizes[i];
                    const angle = (time * 0.1 * (1 - i * 0.2)) + i * (Math.PI * 2 / 5);
                    const px = Math.cos(angle) * radius;
                    const py = Math.sin(angle) * radius;

                    if (Math.hypot(mx - px, my - py) < planetSize / 2) {
                        hovered = { type: 'core', index: i };
                        canvas.style.cursor = 'pointer';
                        return;
                    }

                    // Check tiers and achievements
                    if (focusedCore === i || (camera.scale > 1.5 && Math.hypot(px - (-camera.x), py - (-camera.y)) < 200)) {
                        planet.tiers.forEach((tier, j) => {
                            const tierAngle = j * (Math.PI * 2 / Math.max(planet.tiers.length, 4)) + time * 0.2;
                            const tx = px + Math.cos(tierAngle) * tierRadius;
                            const ty = py + Math.sin(tierAngle) * tierRadius;

                            if (Math.hypot(mx - tx, my - ty) < tierSize / 2) {
                                hovered = { type: 'tier', core: i, tier: j };
                                canvas.style.cursor = 'pointer';
                                return;
                            }

                            // Check achievements
                            if (focusedCore === i && focusedPlanet === j && tier.achievements) {
                                tier.achievements.forEach((ach, k) => {
                                    const achAngle = k * (Math.PI * 2 / tier.achievements.length) + time * 0.1;
                                    const ax = tx + Math.cos(achAngle) * 40;
                                    const ay = ty + Math.sin(achAngle) * 40;

                                    if (Math.hypot(mx - ax, my - ay) < achievementSize / 2 + 5) {
                                        hovered = { type: 'achievement', core: i, tier: j, ach: k };
                                        canvas.style.cursor = 'pointer';
                                    }
                                });
                            }
                        });
                    }
                });
            }

            if (!hovered) {
                canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            isDragging = false;
            
            // Double-click detection
            const currentTime = Date.now();
            if (currentTime - lastClickTime < 300) {
                resetView();
                lastClickTime = 0;
                return;
            }
            lastClickTime = currentTime;

            if (hovered) {
                if (hovered.type === 'core') {
                    focusOnPlanet(hovered.index);
                } else if (hovered.type === 'tier') {
                    focusOnTier(hovered.core, hovered.tier);
                } else if (hovered.type === 'achievement') {
                    showAchievementPopup(hovered.core, hovered.tier, hovered.ach);
                }
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY / 1000;
            const newScale = Math.max(0.1, Math.min(10, targetCamera.scale + delta));
            
            // Zoom towards mouse position
            const mx = (e.clientX - width / 2) / camera.scale - camera.x;
            const my = (e.clientY - height / 2) / camera.scale - camera.y;
            
            const scaleDiff = newScale - targetCamera.scale;
            targetCamera.x -= mx * scaleDiff / newScale;
            targetCamera.y -= my * scaleDiff / newScale;
            targetCamera.scale = newScale;
        });

        // UI Functions
        function focusOnPlanet(planetIndex) {
            if (planetIndex >= orbitRadii.length) return;
            
            const radius = orbitRadii[planetIndex];
            const angle = (time * 0.1 * (1 - planetIndex * 0.2)) + planetIndex * (Math.PI * 2 / 5);
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            
            targetCamera.x = -px;
            targetCamera.y = -py;
            targetCamera.scale = 2;
            focusedCore = planetIndex;
            focusedPlanet = null;
        }

        function focusOnTier(coreIndex, tierIndex) {
            if (coreIndex >= orbitRadii.length) return;
            
            const radius = orbitRadii[coreIndex];
            const angle = (time * 0.1 * (1 - coreIndex * 0.2)) + coreIndex * (Math.PI * 2 / 5);
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            
            const planet = achievements.planets[coreIndex];
            const tierAngle = tierIndex * (Math.PI * 2 / Math.max(planet.tiers.length, 4)) + time * 0.2;
            const tx = px + Math.cos(tierAngle) * tierRadius
