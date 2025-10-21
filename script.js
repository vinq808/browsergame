// Tower Defense Game Configuration
const GRID_SIZE = 60;
const TOWER_COST = 50;
const TOWER_UPGRADE_COST = 75;
const BASE_ENEMY_HEALTH = 50;
const BASE_ENEMY_SPEED = 1;

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game State
let gameState = {
    isRunning: false,
    money: 100,
    health: 100,
    wave: 1,
    kills: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    path: [],
    selectedTower: null,
    waveInProgress: false,
    enemiesSpawned: 0,
    enemiesPerWave: 5
};

// Path generation (enemies follow this)
function generatePath() {
    const path = [];
    const cols = Math.floor(canvas.width / GRID_SIZE);
    const rows = Math.floor(canvas.height / GRID_SIZE);
    
    let x = 0;
    let y = Math.floor(rows / 2);
    path.push({x: x * GRID_SIZE + GRID_SIZE/2, y: y * GRID_SIZE + GRID_SIZE/2});
    
    while (x < cols - 1) {
        if (Math.random() > 0.7 && x > 0) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            if (y + dir >= 0 && y + dir < rows) {
                y += dir;
                path.push({x: x * GRID_SIZE + GRID_SIZE/2, y: y * GRID_SIZE + GRID_SIZE/2});
            }
        }
        x++;
        path.push({x: x * GRID_SIZE + GRID_SIZE/2, y: y * GRID_SIZE + GRID_SIZE/2});
    }
    
    return path;
}

// Tower Class
class Tower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.range = 150;
        this.damage = 20;
        this.fireRate = 1000; // ms
        this.lastFire = 0;
        this.level = 1;
        this.hue = Math.random() * 360;
        this.rotation = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    upgrade() {
        if (gameState.money >= TOWER_UPGRADE_COST) {
            gameState.money -= TOWER_UPGRADE_COST;
            this.level++;
            this.range += 30;
            this.damage += 15;
            this.fireRate = Math.max(300, this.fireRate - 100);
            return true;
        }
        return false;
    }

    findTarget() {
        let target = null;
        let minDist = Infinity;
        
        for (const enemy of gameState.enemies) {
            const dist = Math.sqrt((this.x - enemy.x) ** 2 + (this.y - enemy.y) ** 2);
            if (dist <= this.range && dist < minDist) {
                minDist = dist;
                target = enemy;
            }
        }
        return target;
    }

    update(time) {
        this.rotation += 0.02;
        this.pulsePhase += 0.05;
        this.hue = (this.hue + 0.5) % 360;
        
        if (time - this.lastFire >= this.fireRate) {
            const target = this.findTarget();
            if (target) {
                this.fire(target);
                this.lastFire = time;
            }
        }
    }

    fire(target) {
        gameState.projectiles.push(new Projectile(this.x, this.y, target, this.damage, this.hue));
    }

    draw() {
        const pulse = Math.sin(this.pulsePhase) * 0.2 + 1;
        const size = (20 + this.level * 5) * pulse;
        
        // Draw range indicator when selected
        if (gameState.selectedTower === this) {
            ctx.save();
            ctx.strokeStyle = `hsla(${this.hue}, 100%, 50%, 0.3)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Tower base
        ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        ctx.shadowBlur = 20;
        ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, 0.8)`;
        
        // Psychedelic tower shape
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = i % 2 === 0 ? size : size * 0.6;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = `hsla(${(this.hue + 180) % 360}, 100%, 70%, 0.9)`;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Level indicator
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.level, 0, 0);
        
        ctx.restore();
    }

    isClicked(mx, my) {
        const dist = Math.sqrt((this.x - mx) ** 2 + (this.y - my) ** 2);
        return dist < 20 + this.level * 5;
    }
}

// Enemy Class
class Enemy {
    constructor() {
        this.pathIndex = 0;
        this.x = gameState.path[0].x;
        this.y = gameState.path[0].y;
        this.health = BASE_ENEMY_HEALTH * gameState.wave;
        this.maxHealth = this.health;
        this.speed = BASE_ENEMY_SPEED + gameState.wave * 0.1;
        this.size = 15;
        this.hue = Math.random() * 360;
        this.rotation = Math.random() * Math.PI * 2;
        this.morphPhase = Math.random() * Math.PI * 2;
    }

    update() {
        if (this.pathIndex >= gameState.path.length - 1) {
            gameState.health -= 10;
            return false; // Enemy reached end
        }
        
        const target = gameState.path[this.pathIndex + 1];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.speed) {
            this.pathIndex++;
            if (this.pathIndex >= gameState.path.length - 1) {
                gameState.health -= 10;
                return false;
            }
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
        
        this.rotation += 0.05;
        this.morphPhase += 0.03;
        this.hue = (this.hue + 1) % 360;
        
        return true;
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            gameState.money += 25;
            gameState.kills++;
            return false;
        }
        return true;
    }

    draw() {
        const morph = Math.sin(this.morphPhase) * 0.3 + 1;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Enemy body - morphing blob
        ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        ctx.shadowBlur = 15;
        ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, 0.7)`;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r = this.size * (i % 2 === 0 ? morph : 1);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        
        // Health bar
        const barWidth = 30;
        const barHeight = 4;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 10, barWidth, barHeight);
        
        ctx.fillStyle = `hsl(${healthPercent * 120}, 100%, 50%)`;
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 10, barWidth * healthPercent, barHeight);
    }
}

// Projectile Class
class Projectile {
    constructor(x, y, target, damage, hue) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 8;
        this.hue = hue;
        this.trail = [];
    }

    update() {
        if (!this.target || !gameState.enemies.includes(this.target)) {
            return false;
        }
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift();
        
        if (dist < this.speed) {
            // Hit target
            return !this.target.takeDamage(this.damage);
        }
        
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
        
        return true;
    }

    draw() {
        // Draw trail
        ctx.strokeStyle = `hsla(${this.hue}, 100%, 50%, 0.5)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
            const p = this.trail[i];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        
        // Draw projectile
        ctx.save();
        ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `hsl(${this.hue}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Spawn wave
function spawnWave() {
    gameState.waveInProgress = true;
    gameState.enemiesSpawned = 0;
    gameState.enemiesPerWave = 5 + gameState.wave * 2;
    
    const spawnInterval = setInterval(() => {
        if (!gameState.isRunning) {
            clearInterval(spawnInterval);
            return;
        }
        
        gameState.enemies.push(new Enemy());
        gameState.enemiesSpawned++;
        
        if (gameState.enemiesSpawned >= gameState.enemiesPerWave) {
            clearInterval(spawnInterval);
        }
    }, 1000);
}

// Update game
function update() {
    if (!gameState.isRunning) return;
    
    const time = Date.now();
    
    // Update towers
    gameState.towers.forEach(tower => tower.update(time));
    
    // Update enemies
    gameState.enemies = gameState.enemies.filter(enemy => enemy.update());
    
    // Update projectiles
    gameState.projectiles = gameState.projectiles.filter(proj => proj.update());
    
    // Check if wave is complete
    if (gameState.waveInProgress && 
        gameState.enemiesSpawned >= gameState.enemiesPerWave && 
        gameState.enemies.length === 0) {
        gameState.waveInProgress = false;
        gameState.wave++;
        gameState.money += 50;
        setTimeout(() => {
            if (gameState.isRunning) spawnWave();
        }, 3000);
    }
    
    // Check game over
    if (gameState.health <= 0) {
        endGame(false);
    }
}

// Draw game
function draw() {
    // Psychedelic grid background
    const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
    grad.addColorStop(0, 'rgba(157, 0, 255, 0.1)');
    grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.05)');
    grad.addColorStop(1, 'rgba(255, 0, 110, 0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= canvas.width; i += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
    
    // Draw path with glow
    ctx.strokeStyle = 'rgba(255, 0, 110, 0.4)';
    ctx.lineWidth = 30;
    ctx.shadowColor = 'rgba(255, 0, 110, 0.8)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    gameState.path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Draw entities
    gameState.towers.forEach(tower => tower.draw());
    gameState.projectiles.forEach(proj => proj.draw());
    gameState.enemies.forEach(enemy => enemy.draw());
}

// Handle canvas click
canvas.addEventListener('click', (e) => {
    if (!gameState.isRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking existing tower
    for (const tower of gameState.towers) {
        if (tower.isClicked(x, y)) {
            if (gameState.selectedTower === tower) {
                // Upgrade
                tower.upgrade();
            } else {
                gameState.selectedTower = tower;
            }
            return;
        }
    }
    
    gameState.selectedTower = null;
    
    // Place new tower
    if (gameState.money >= TOWER_COST) {
        const gridX = Math.floor(x / GRID_SIZE) * GRID_SIZE + GRID_SIZE/2;
        const gridY = Math.floor(y / GRID_SIZE) * GRID_SIZE + GRID_SIZE/2;
        
        // Check if on path
        const onPath = gameState.path.some(p => 
            Math.abs(p.x - gridX) < GRID_SIZE/2 && Math.abs(p.y - gridY) < GRID_SIZE/2
        );
        
        // Check if tower already there
        const towerExists = gameState.towers.some(t => 
            Math.abs(t.x - gridX) < GRID_SIZE/2 && Math.abs(t.y - gridY) < GRID_SIZE/2
        );
        
        if (!onPath && !towerExists) {
            gameState.money -= TOWER_COST;
            gameState.towers.push(new Tower(gridX, gridY));
        }
    }
});

// Update UI
function updateUI() {
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('wave').textContent = gameState.wave;
    document.getElementById('health').textContent = gameState.health;
    document.getElementById('kills').textContent = gameState.kills;
}

// Start game
function startGame() {
    gameState.isRunning = true;
    gameState.money = 100;
    gameState.health = 100;
    gameState.wave = 1;
    gameState.kills = 0;
    gameState.towers = [];
    gameState.enemies = [];
    gameState.projectiles = [];
    gameState.selectedTower = null;
    gameState.waveInProgress = false;
    gameState.path = generatePath();
    
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    
    spawnWave();
    gameLoop();
}

// End game
function endGame(won) {
    gameState.isRunning = false;
    const result = won ? "You transcended reality!" : "Reality has consumed you...";
    document.getElementById('tripResult').textContent = result;
    document.getElementById('finalWave').textContent = gameState.wave;
    document.getElementById('finalKills').textContent = gameState.kills;
    document.getElementById('gameOver').classList.remove('hidden');
}

// Game loop
function gameLoop() {
    update();
    draw();
    updateUI();
    
    if (gameState.isRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// Initial UI
updateUI();
