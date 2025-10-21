// Simple Tower Defense Configuration
const GRID_SIZE = 50;
const TOWER_COST = 100;
const TOWER_UPGRADE_COST = 150;

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
    money: 200,
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
    enemiesPerWave: 10
};

// Simple straight path
function generatePath() {
    const path = [];
    const y = canvas.height / 2;
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
        path.push({
            x: (canvas.width / steps) * i,
            y: y
        });
    }
    
    return path;
}

// Tower Class - Bloons TD style
class Tower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.range = 100;
        this.damage = 10;
        this.fireRate = 600;
        this.lastFire = 0;
        this.level = 1;
        this.maxLevel = 5;
    }

    getUpgradeCost() {
        return TOWER_UPGRADE_COST * this.level;
    }

    upgrade() {
        if (this.level >= this.maxLevel) return false;
        
        const cost = this.getUpgradeCost();
        if (gameState.money >= cost) {
            gameState.money -= cost;
            this.level++;
            this.range += 20;
            this.damage += 8;
            this.fireRate = Math.max(200, this.fireRate - 80);
            return true;
        }
        return false;
    }

    findTarget() {
        let target = null;
        let maxProgress = -1;
        
        // Target enemy furthest along path (like Bloons)
        for (const enemy of gameState.enemies) {
            const dist = Math.sqrt((this.x - enemy.x) ** 2 + (this.y - enemy.y) ** 2);
            if (dist <= this.range && enemy.pathIndex > maxProgress) {
                maxProgress = enemy.pathIndex;
                target = enemy;
            }
        }
        return target;
    }

    update(time) {
        if (time - this.lastFire >= this.fireRate) {
            const target = this.findTarget();
            if (target) {
                this.fire(target);
                this.lastFire = time;
            }
        }
    }

    fire(target) {
        gameState.projectiles.push(new Projectile(this.x, this.y, target, this.damage));
    }

    draw() {
        const baseSize = 16;
        const size = baseSize + this.level * 2;
        
        // Range indicator when selected
        if (gameState.selectedTower === this) {
            ctx.strokeStyle = 'rgba(102, 153, 204, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.stroke();
            
            // Show upgrade info
            if (this.level < this.maxLevel) {
                const cost = this.getUpgradeCost();
                ctx.fillStyle = '#6699cc';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`$${cost}`, this.x, this.y - size - 10);
            }
        }
        
        // Tower body - circle
        ctx.fillStyle = '#6699cc';
        ctx.beginPath();
        ctx.arc(this.x, this.y, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = '#8ab4d9';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner core based on level
        if (this.level > 1) {
            ctx.fillStyle = '#4d79a3';
            ctx.beginPath();
            ctx.arc(this.x, this.y, size/3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Level indicator dots
        for (let i = 0; i < this.level && i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const dotDist = size/2 + 4;
            const dotX = this.x + Math.cos(angle) * dotDist;
            const dotY = this.y + Math.sin(angle) * dotDist;
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    isClicked(mx, my) {
        const size = 16 + this.level * 2;
        const dist = Math.sqrt((this.x - mx) ** 2 + (this.y - my) ** 2);
        return dist <= size/2 + 5;
    }
}

// Enemy Class - Bloons style
class Enemy {
    constructor() {
        this.pathIndex = 0;
        this.x = gameState.path[0].x;
        this.y = gameState.path[0].y;
        this.health = 30 + gameState.wave * 15;
        this.maxHealth = this.health;
        this.speed = 1.2 + gameState.wave * 0.08;
        this.size = 10;
        this.reward = 10 + gameState.wave * 2;
    }

    update() {
        if (this.pathIndex >= gameState.path.length - 1) {
            gameState.health -= 1;
            return false;
        }
        
        const target = gameState.path[this.pathIndex + 1];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.speed) {
            this.pathIndex++;
            if (this.pathIndex >= gameState.path.length - 1) {
                gameState.health -= 1;
                return false;
            }
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
        
        return true;
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            gameState.money += this.reward;
            gameState.kills++;
            return false; // Enemy dies
        }
        return true; // Enemy survives
    }

    draw() {
        // Only draw if health > 0
        if (this.health <= 0) return;
        
        // Enemy body - hexagon shape
        ctx.fillStyle = '#cc3333';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = this.x + Math.cos(angle) * this.size;
            const y = this.y + Math.sin(angle) * this.size;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Health bar only if damaged
        if (this.health < this.maxHealth) {
            const barWidth = 20;
            const barHeight = 3;
            const healthPercent = Math.max(0, this.health / this.maxHealth);
            
            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x - barWidth/2, this.y - this.size - 8, barWidth, barHeight);
            
            // Health
            ctx.fillStyle = '#cc3333';
            ctx.fillRect(this.x - barWidth/2, this.y - this.size - 8, barWidth * healthPercent, barHeight);
        }
    }
}

// Projectile Class - Simple
class Projectile {
    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 7;
    }

    update() {
        // Check if target still exists and is alive
        if (!this.target || !gameState.enemies.includes(this.target) || this.target.health <= 0) {
            return false;
        }
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.speed) {
            // Hit target
            const targetAlive = this.target.takeDamage(this.damage);
            return false; // Projectile disappears after hit
        }
        
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
        
        return true;
    }

    draw() {
        ctx.fillStyle = '#6699cc';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#8ab4d9';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// Spawn wave - Bloons style
function spawnWave() {
    gameState.waveInProgress = true;
    gameState.enemiesSpawned = 0;
    gameState.enemiesPerWave = 10 + gameState.wave * 3;
    
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
    }, 800); // Spawn every 0.8 seconds
}

// Update game
function update() {
    if (!gameState.isRunning) return;
    
    const time = Date.now();
    
    gameState.towers.forEach(tower => tower.update(time));
    gameState.enemies = gameState.enemies.filter(enemy => enemy.update());
    gameState.projectiles = gameState.projectiles.filter(proj => proj.update());
    
    // Check if wave complete
    if (gameState.waveInProgress && 
        gameState.enemiesSpawned >= gameState.enemiesPerWave && 
        gameState.enemies.length === 0) {
        gameState.waveInProgress = false;
        gameState.wave++;
        gameState.money += 100 + gameState.wave * 20; // Wave completion bonus
        setTimeout(() => {
            if (gameState.isRunning) spawnWave();
        }, 3000);
    }
    
    if (gameState.health <= 0) {
        endGame();
    }
}

// Draw game - Clean and simple
function draw() {
    // Clear with black
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw subtle grid
    ctx.strokeStyle = 'rgba(102, 153, 204, 0.1)';
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
    
    // Draw path
    ctx.strokeStyle = 'rgba(153, 153, 153, 0.3)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    gameState.path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    
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
    
    // Check tower click
    for (const tower of gameState.towers) {
        if (tower.isClicked(x, y)) {
            if (gameState.selectedTower === tower) {
                // Try to upgrade
                if (tower.upgrade()) {
                    // Upgrade successful
                }
            } else {
                // Select tower
                gameState.selectedTower = tower;
            }
            return;
        }
    }
    
    // Clicked empty space - deselect and try to place tower
    gameState.selectedTower = null;
    
    // Place new tower
    if (gameState.money >= TOWER_COST) {
        const gridX = Math.floor(x / GRID_SIZE) * GRID_SIZE + GRID_SIZE/2;
        const gridY = Math.floor(y / GRID_SIZE) * GRID_SIZE + GRID_SIZE/2;
        
        // Check if on path
        const onPath = gameState.path.some(p => 
            Math.abs(p.x - gridX) < 25 && Math.abs(p.y - gridY) < 25
        );
        
        // Check if tower exists
        const towerExists = gameState.towers.some(t => 
            Math.abs(t.x - gridX) < 25 && Math.abs(t.y - gridY) < 25
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
    gameState.money = 200;
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
function endGame() {
    gameState.isRunning = false;
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
