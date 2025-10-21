// Game Configuration
const GAME_DURATION = 300; // 5 minutes in seconds
const PARTICLE_SIZE = 15;
const CORRUPTION_SIZE = 18;

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game State
let gameState = {
    isRunning: false,
    score: 0,
    missed: 0,
    timeLeft: GAME_DURATION,
    particles: [],
    corrupted: [],
    startTime: null
};

// Particle Class (collectible)
class Particle {
    constructor() {
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = Math.random() * (canvas.height - 40) + 20;
        this.size = PARTICLE_SIZE;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.hue = Math.random() * 120; // Cyan to Green range
        this.life = 1;
        this.fadeSpeed = 0.003;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.life -= this.fadeSpeed;

        // Bounce off walls
        if (this.x - this.size < 0 || this.x + this.size > canvas.width) this.vx *= -1;
        if (this.y - this.size < 0 || this.y + this.size > canvas.height) this.vy *= -1;

        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw crystalline entity
        ctx.fillStyle = `hsla(180, 100%, 50%, ${this.life * 0.6})`;
        ctx.shadowColor = `hsla(180, 100%, 50%, 1)`;
        ctx.shadowBlur = 15;
        
        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `hsla(${this.hue}, 100%, 60%, ${this.life})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    isClicked(x, y) {
        const dist = Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2);
        return dist < this.size + 10;
    }
}

// Corrupted Particle Class (avoid)
class CorruptedParticle {
    constructor() {
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = Math.random() * (canvas.height - 40) + 20;
        this.size = CORRUPTION_SIZE;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.life = 1;
        this.fadeSpeed = 0.002;
        this.glitch = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.life -= this.fadeSpeed;
        this.glitch = Math.random() * 3;

        // Bounce off walls
        if (this.x - this.size < 0 || this.x + this.size > canvas.width) this.vx *= -1;
        if (this.y - this.size < 0 || this.y + this.size > canvas.height) this.vy *= -1;

        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x + (Math.random() - 0.5) * this.glitch, 
                     this.y + (Math.random() - 0.5) * this.glitch);
        ctx.rotate(this.rotation);

        // Draw corrupted entity (spiky)
        ctx.fillStyle = `hsla(0, 100%, 50%, ${this.life * 0.5})`;
        ctx.shadowColor = `hsla(0, 100%, 50%, 1)`;
        ctx.shadowBlur = 20;
        
        const spikes = 6;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2;
            const r = i % 2 === 0 ? this.size : this.size * 0.4;
            const xx = Math.cos(angle) * r;
            const yy = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `hsla(0, 100%, 60%, ${this.life})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    isClicked(x, y) {
        const dist = Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2);
        return dist < this.size + 10;
    }
}

// Spawn particles
function spawnParticle() {
    if (Math.random() > 0.3) {
        gameState.particles.push(new Particle());
    } else {
        gameState.corrupted.push(new CorruptedParticle());
    }
}

// Update game
function update() {
    if (!gameState.isRunning) return;

    // Update time
    const now = Date.now();
    gameState.timeLeft = Math.max(0, GAME_DURATION - Math.floor((now - gameState.startTime) / 1000));

    // Spawn new particles
    if (Math.random() > 0.92) spawnParticle();

    // Update particles
    gameState.particles = gameState.particles.filter(p => {
        p.update();
        return p.life > 0;
    });

    // Update corrupted
    gameState.corrupted = gameState.corrupted.filter(c => {
        c.update();
        return c.life > 0;
    });

    // Check game over
    if (gameState.timeLeft === 0) {
        endGame();
    }
}

// Draw game
function draw() {
    // Clear canvas with gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0.02)');
    grad.addColorStop(0.5, 'rgba(157, 0, 255, 0.02)');
    grad.addColorStop(1, 'rgba(0, 255, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Draw particles
    gameState.particles.forEach(p => p.draw());
    gameState.corrupted.forEach(c => c.draw());

    // Draw center point (void center)
    ctx.fillStyle = 'rgba(255, 0, 110, 0.1)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 100, 0, Math.PI * 2);
    ctx.fill();
}

// Handle clicks
canvas.addEventListener('click', (e) => {
    if (!gameState.isRunning && document.getElementById('overlay').classList.contains('hidden')) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on good particle
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        if (gameState.particles[i].isClicked(x, y)) {
            gameState.score++;
            gameState.particles.splice(i, 1);
            createClickEffect(x, y, 'good');
            return;
        }
    }

    // Check if clicked on corrupted
    for (let i = gameState.corrupted.length - 1; i >= 0; i--) {
        if (gameState.corrupted[i].isClicked(x, y)) {
            gameState.missed++;
            gameState.corrupted.splice(i, 1);
            createClickEffect(x, y, 'bad');
            return;
        }
    }
});

// Click effect
function createClickEffect(x, y, type) {
    const particles = [];
    const count = type === 'good' ? 8 : 5;
    const color = type === 'good' ? 'hsl(180, 100%, 50%)' : 'hsl(0, 100%, 50%)';

    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color: color
        });
    }

    // Animate effect
    const animateEffect = () => {
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // gravity
            p.life -= 0.05;

            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        if (particles[0].life > 0) {
            requestAnimationFrame(animateEffect);
        }
    };
    animateEffect();
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('missed').textContent = gameState.missed;
    
    const minutes = Math.floor(gameState.timeLeft / 60);
    const seconds = gameState.timeLeft % 60;
    document.getElementById('timer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Start game
function startGame() {
    gameState.isRunning = true;
    gameState.score = 0;
    gameState.missed = 0;
    gameState.timeLeft = GAME_DURATION;
    gameState.particles = [];
    gameState.corrupted = [];
    gameState.startTime = Date.now();
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    spawnParticle();
    gameLoop();
}

// End game
function endGame() {
    gameState.isRunning = false;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalMissed').textContent = gameState.missed;
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

// Initial UI update
updateUI();

// CRT flicker effect on canvas occasionally
setInterval(() => {
    if (gameState.isRunning) {
        ctx.fillStyle = 'rgba(255, 0, 110, 0.02)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}, 100);
