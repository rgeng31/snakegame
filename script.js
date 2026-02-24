const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverTitle = gameOverScreen.querySelector('h2');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const resetHighScoreBtn = document.getElementById('reset-high-score');
const deathEmoji = document.getElementById('death-emoji');

// Background Music
const bgMusic = new Audio('freemusicforvideo-space-ambient.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5; // Set to a reasonable level

// Game constants
const SNAKE_RADIUS = 10;
const FOOD_RADIUS = 8;
let movementSpeed = 10; // Increased base speed
const INITIAL_LENGTH = 20; // Number of segments
const SEGMENT_DISTANCE = 5; // Distance between segments

// ... (skipping unchanged code)

// Game state
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoopId;
let gameRunning = false;
let gamePaused = false;
let gameStartTime = 0;
let isBoosting = false;
let isFlashing = false;
let flashStartTime = 0;

// Snake state
// Array of {x, y} coordinates
let snake = [];
let snakeColor = localStorage.getItem('snakeColor') || '#4CAF50';

// Mouse state
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let currentAngle = 0; // Track current movement angle

// Food state
let foods = [];
const MAX_FOOD_COUNT = 5;

// Obstacle state
let obstacles = [];
let lastObstacleTime = 0;
const OBSTACLE_INTERVAL = 5000; // Spawn every 5 seconds
const OBSTACLE_LIFETIME = 10000; // Lasts 10 seconds

// Boost state
const BOOST_RADIUS = 15;
const BOOST_SPAWN_INTERVAL = 30000; // 30 seconds
const BOOST_DURATION = 10000; // 10 seconds
const BOOST_TYPES = {
    SPEED: { name: 'Speed', color: '#FFEB3B', textColor: '#000', icon: '⚡' },
    INVINCIBILITY: { name: 'Invincibility', color: '#9C27B0', textColor: '#fff', icon: '🛡️' },
    DOUBLE_POINTS: { name: 'Double Points', color: '#00BCD4', textColor: '#000', icon: '2x' }
};
let boosts = [];
let lastBoostSpawnTime = 0;
let activeBoosts = {
    speed: 0,
    invincibility: 0,
    doublePoints: 0
};

// Initialize high score display
highScoreElement.textContent = highScore;

// Resize canvas to fit screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Initial resize
resizeCanvas();

// Event listeners
window.addEventListener('resize', () => {
    resizeCanvas();
    if (!gameRunning) {
        draw();
    }
});

// Color Palette
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', (e) => {
        const color = e.target.getAttribute('data-color');
        snakeColor = color;
        localStorage.setItem('snakeColor', snakeColor);
        draw(); // Redraw immediately to show change

        // Update UI active state
        updateActiveColor(e.target);
    });

    // Set initial active state
    if (option.getAttribute('data-color') === snakeColor) {
        option.classList.add('active');
    }
});

function updateActiveColor(clickedOption) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
    clickedOption.classList.add('active');
}

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

window.addEventListener('mousedown', (e) => {
    if (gameRunning && !gamePaused) isBoosting = true;
});

window.addEventListener('mouseup', () => {
    isBoosting = false;
});

document.addEventListener('keydown', (e) => {
    if (!gameRunning && startScreen.classList.contains('hidden') === false) {
        startGame();
    }
});

canvas.addEventListener('click', () => {
    if (!gameRunning && startScreen.classList.contains('hidden') === false) {
        startGame();
    }
});

restartBtn.addEventListener('click', startGame);

resetHighScoreBtn.addEventListener('click', () => {
    localStorage.removeItem('snakeHighScore');
    highScore = 0;
    highScoreElement.textContent = '0';
});

function initGame() {
    score = 0;
    scoreElement.textContent = score;

    // Start in middle
    const startX = canvas.width / 2;
    const startY = canvas.height / 2;

    snake = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
        snake.push({
            x: startX - (i * SEGMENT_DISTANCE),
            y: startY
        });
    }

    // Reset mouse target to current head to prevent instant turn
    mouseX = startX;
    mouseY = startY;

    obstacles = [];
    lastObstacleTime = Date.now();

    boosts = [];
    lastBoostSpawnTime = Date.now();
    activeBoosts = {
        speed: 0,
        invincibility: 0,
        doublePoints: 0
    };

    for (let i = 0; i < MAX_FOOD_COUNT; i++) {
        generateFood();
    }
}

function startGame() {
    if (gameRunning) return;

    initGame();
    gameRunning = true;
    gamePaused = false;
    gameStartTime = Date.now();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    // Use requestAnimationFrame for smoother animation
    if (gameLoopId) cancelAnimationFrame(gameLoopId);

    // Start background music
    bgMusic.play().catch(e => console.log("Music autoplay prevented:", e));

    gameLoop();
}

function gameOver(reason) {
    playDeathSound();

    // Show giant laughing emoji for 2 seconds
    if (deathEmoji) {
        deathEmoji.classList.remove('hidden');
        setTimeout(() => {
            deathEmoji.classList.add('hidden');
        }, 3000);
    }

    gameRunning = false;
    cancelAnimationFrame(gameLoopId);

    // Stop background music
    bgMusic.pause();
    bgMusic.currentTime = 0;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreElement.textContent = highScore;
    }

    let message = "";

    // 1. Random "Bonus" messages (25% chance)
    if (Math.random() < 0.25) {
        message = Math.random() < 0.5 ? "HEHE YOU SUCK" : "gotcha";
    }
    // 2. Score triggers
    else if (score > 2000) {
        message = "Do you touch grass?????";
    } else if (score < 30) {
        message = "ARE YOU EVEN TRYING????";
    }
    // 3. Fallback to reason
    else {
        switch (reason) {
            case 'wall':
                message = "why are you trying to leave?? its so nice here!!";
                break;
            case 'self':
                message = "you suck >:)";
                break;
            case 'obstacle':
                message = "You were tagged by Red Box";
                break;
            default:
                message = "Game Over!";
        }
    }

    gameOverTitle.textContent = message;
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

function gameLoop() {
    if (!gameRunning) return;
    if (gameRunning && !gamePaused) {
        // Random background flash logic (on average once every 14s at 60fps)
        if (!isFlashing && Math.random() < (1 / 840)) {
            isFlashing = true;
            flashStartTime = Date.now();
        }

        moveSnake();
        updateObstacles(); // Manage obstacles
        updateBoosts(); // Manage boosts

        const deathReason = checkValues();
        if (deathReason === true) {
            draw();
            gameLoopId = requestAnimationFrame(gameLoop);
        } else {
            gameOver(deathReason);
        }
    }
}

function moveSnake() {
    // 1. Move Head towards mouse
    const head = snake[0];

    // Calculate angle to mouse
    const dx = mouseX - head.x;
    const dy = mouseY - head.y;
    const distanceToMouse = Math.sqrt(dx * dx + dy * dy);

    // Update angle only if we are far enough (prevents jitter), otherwise keep old angle
    if (distanceToMouse > 5) {
        currentAngle = Math.atan2(dy, dx);
    }

    let currentEffectiveSpeed = isBoosting ? movementSpeed * 1.4 : movementSpeed;

    // Apply speed boost effect
    if (Date.now() < activeBoosts.speed) {
        currentEffectiveSpeed *= 1.5;
    }

    const newHeadX = head.x + Math.cos(currentAngle) * currentEffectiveSpeed;
    const newHeadY = head.y + Math.sin(currentAngle) * currentEffectiveSpeed;

    // 2. Move Body - Drag segments
    // Update head
    head.x = newHeadX;
    head.y = newHeadY;

    for (let i = 1; i < snake.length; i++) {
        const current = snake[i];
        const prev = snake[i - 1]; // The segment ahead of us

        const dx = prev.x - current.x;
        const dy = prev.y - current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > SEGMENT_DISTANCE) {
            // Move towards prev until distance is exactly SEGMENT_DISTANCE
            const angle = Math.atan2(dy, dx);
            current.x = prev.x - Math.cos(angle) * SEGMENT_DISTANCE;
            current.y = prev.y - Math.sin(angle) * SEGMENT_DISTANCE;
        }
    }
}

function checkValues() {
    const head = snake[0];

    // 1. Wall Collision
    const isInvincible = Date.now() < activeBoosts.invincibility;

    if (!isInvincible) {
        if (head.x < SnakeRadius() || head.x > canvas.width - SnakeRadius() ||
            head.y < SnakeRadius() || head.y > canvas.height - SnakeRadius()) {
            return 'wall'; // Game Over
        }
    }

    // 2. Self Collision - REMOVED as per request

    // 3. Check Food
    for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        const dfx = head.x - f.x;
        const dfy = head.y - f.y;
        const distFood = Math.sqrt(dfx * dfx + dfy * dfy);

        if (distFood < SNAKE_RADIUS + (f.radius || FOOD_RADIUS)) {
            // Eat food
            const points = Date.now() < activeBoosts.doublePoints ? 20 : 10;
            score += points;
            scoreElement.textContent = score;

            // Grow snake - Add segments to the end
            const tail = snake[snake.length - 1];
            // Add 5 segments for length
            for (let k = 0; k < 5; k++) {
                snake.push({ x: tail.x, y: tail.y });
            }

            foods.splice(i, 1);
            generateFood();
        }
    }

    // 4. Check Obstacles
    if (!isInvincible) {
        for (const obs of obstacles) {
            // Check collision against EVERY segment of the snake
            for (const segment of snake) {
                // Find the closest point on the rectangle to the segment circle center
                const closestX = Math.max(obs.x, Math.min(segment.x, obs.x + obs.width));
                const closestY = Math.max(obs.y, Math.min(segment.y, obs.y + obs.height));

                // Calculate the distance between the closest point and the circle's center
                const distanceX = segment.x - closestX;
                const distanceY = segment.y - closestY;
                const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

                // Add a small buffer (2px) to make it fairer/more lethal as requested
                const collisionRadius = SNAKE_RADIUS - 2;
                if (distanceSquared < (collisionRadius * collisionRadius)) {
                    return 'obstacle'; // Collision detected with some part of the snake body
                }
            }
        }
    }

    // 5. Check Boosts
    for (let i = boosts.length - 1; i >= 0; i--) {
        const boost = boosts[i];
        const dx = head.x - boost.x;
        const dy = head.y - boost.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < SNAKE_RADIUS + BOOST_RADIUS) {
            applyBoost(boost.type);
            boosts.splice(i, 1);
        }
    }

    return true; // Game Continues
}

function SnakeRadius() {
    return SNAKE_RADIUS;
}

function generateFood() {
    const margin = 50;
    const randomRadius = FOOD_RADIUS * (Math.random() * (2.0 - 0.5) + 0.5);
    const hue = Math.floor(Math.random() * 360);
    const randomColor = `hsl(${hue}, 100%, 50%)`;

    foods.push({
        x: margin + Math.random() * (canvas.width - margin * 2),
        y: margin + Math.random() * (canvas.height - margin * 2),
        radius: randomRadius,
        color: randomColor
    });
}

function updateObstacles() {
    const now = Date.now();

    // Spawn new obstacle
    if (now - lastObstacleTime > OBSTACLE_INTERVAL) {
        // Smaller size
        const size = Math.random() * 160 + 100;
        const margin = 50;

        // Increased velocity (1.5x previous high speed)
        const speed = 8;
        const vx = (Math.random() - 0.5) * speed * 2;
        const vy = (Math.random() - 0.5) * speed * 2;

        const newObs = {
            x: margin + Math.random() * (canvas.width - margin * 2 - size),
            y: margin + Math.random() * (canvas.height - margin * 2 - size),
            width: size,
            height: size,
            dx: vx,
            dy: vy,
            createdAt: now
        };

        // Don't spawn on top of snake head
        const dx = newObs.x + newObs.width / 2 - snake[0].x;
        const dy = newObs.y + newObs.height / 2 - snake[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 400) { // Increased safe distance due to massive size
            obstacles.push(newObs);
            // lastObstacleTime is updated only when we successfully push?
            // Yes, otherwise we retry next frame.
            lastObstacleTime = now;
        }
    }

    // Update Obstacles Movement
    obstacles.forEach(obs => {
        // If dx/dy don't exist (old obstacles), init them
        if (typeof obs.dx === 'undefined') obs.dx = (Math.random() - 0.5) * 4;
        if (typeof obs.dy === 'undefined') obs.dy = (Math.random() - 0.5) * 4;

        obs.x += obs.dx;
        obs.y += obs.dy;

        // Bounce off walls
        if (obs.x <= 0) {
            obs.x = 0;
            obs.dx *= -1;
        }
        if (obs.x + obs.width >= canvas.width) {
            obs.x = canvas.width - obs.width;
            obs.dx *= -1;
        }
        if (obs.y <= 0) {
            obs.y = 0;
            obs.dy *= -1;
        }
        if (obs.y + obs.height >= canvas.height) {
            obs.y = canvas.height - obs.height;
            obs.dy *= -1;
        }
    });

    // Check for Obstacle-Obstacle Collisions
    for (let i = 0; i < obstacles.length; i++) {
        for (let j = i + 1; j < obstacles.length; j++) {
            const obs1 = obstacles[i];
            const obs2 = obstacles[j];

            // AABB Collision
            if (obs1.x < obs2.x + obs2.width &&
                obs1.x + obs1.width > obs2.x &&
                obs1.y < obs2.y + obs2.height &&
                obs1.y + obs1.height > obs2.y) {

                // Swap velocities to simulate unnecessary bounce
                const tempDx = obs1.dx;
                obs1.dx = obs2.dx;
                obs2.dx = tempDx;

                const tempDy = obs1.dy;
                obs1.dy = obs2.dy;
                obs2.dy = tempDy;

                // Separate slightly to prevent sticking (simple nudge)
                // Just moving one of them slightly away? 
                // For simplicity in this chaotic mode, we rely on the velocity swap to separate them over time.
            }
        }
    }

    // Remove old obstacles
    obstacles = obstacles.filter(obs => now - obs.createdAt < OBSTACLE_LIFETIME);
}

function updateBoosts() {
    const now = Date.now();

    if (now - lastBoostSpawnTime > BOOST_SPAWN_INTERVAL) {
        // Spawn 2-3 boosts at once
        const count = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < count; i++) {
            spawnBoost();
        }
        lastBoostSpawnTime = now;
    }
}

function spawnBoost() {
    const margin = 50;
    const types = Object.keys(BOOST_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];

    const newBoost = {
        x: margin + Math.random() * (canvas.width - margin * 2),
        y: margin + Math.random() * (canvas.height - margin * 2),
        type: type,
        createdAt: Date.now()
    };

    boosts.push(newBoost);
}

function applyBoost(type) {
    const now = Date.now();
    const duration = BOOST_DURATION;

    if (type === 'SPEED') {
        activeBoosts.speed = now + duration;
    } else if (type === 'INVINCIBILITY') {
        activeBoosts.invincibility = now + duration;
    } else if (type === 'DOUBLE_POINTS') {
        activeBoosts.doublePoints = now + duration;
    }
}

// Custom recording death sound
function playDeathSound() {
    try {
        const deathAudio = new Audio('dying_voice.m4a');
        deathAudio.play();
    } catch (e) {
        console.log("Audio playback error", e);
    }
}

function draw() {
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 0. Draw Boosts on map
    boosts.forEach(boost => {
        const config = BOOST_TYPES[boost.type];

        ctx.save();
        ctx.beginPath();
        ctx.arc(boost.x, boost.y, BOOST_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = config.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = config.color;
        ctx.fill();
        ctx.closePath();

        ctx.fillStyle = config.textColor;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, boost.x, boost.y);
        ctx.restore();
    });

    // 1. Draw Obstacles
    const flash = Math.abs(Math.sin(Date.now() / 150));
    const obstacleColor = `rgb(${100 + 155 * flash}, 0, 0)`;

    ctx.fillStyle = obstacleColor;
    ctx.strokeStyle = '#300';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10 * flash;
    ctx.shadowColor = '#F00';

    obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });
    ctx.shadowBlur = 0;

    // 2. Draw Food
    foods.forEach(food => {
        const orbRadius = food.radius || FOOD_RADIUS;
        const orbColor = food.color || '#FF5722';

        ctx.beginPath();
        ctx.arc(food.x, food.y, orbRadius, 0, Math.PI * 2);
        ctx.fillStyle = orbColor;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = orbColor;
        ctx.closePath();
    });
    ctx.shadowBlur = 0;

    // 3. Draw Snake
    const now = Date.now();
    const isInvincible = now < activeBoosts.invincibility;
    const isSpeedy = now < activeBoosts.speed;
    const isDoublePoints = now < activeBoosts.doublePoints;

    const flashAlpha = 1;

    for (let i = snake.length - 1; i >= 0; i--) {
        const segment = snake[i];

        // Boost aura effect
        if (isBoosting || isSpeedy || isInvincible || isDoublePoints) {
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, SNAKE_RADIUS * 1.4, 0, Math.PI * 2);

            if (isInvincible) {
                const hue = (Date.now() / 5 + i * 10) % 360;
                ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.3)`;
            } else if (isSpeedy) {
                ctx.fillStyle = 'rgba(255, 235, 59, 0.3)';
            } else if (isDoublePoints) {
                ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
            } else {
                ctx.fillStyle = i === 0 ? 'rgba(255, 165, 0, 0.4)' : 'rgba(255, 69, 0, 0.2)';
            }

            ctx.fill();
            ctx.closePath();
        }

        ctx.beginPath();
        ctx.arc(segment.x, segment.y, SNAKE_RADIUS, 0, Math.PI * 2);

        // Color logic
        if (snakeColor === 'rainbow') {
            const hue = (i * 10 + Date.now() / 10) % 360;
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${flashAlpha})`;
        } else {
            let baseColor = snakeColor;
            if (i > 0 && i % 2 !== 0) {
                baseColor = adjustColor(snakeColor, -20);
            }

            if (isInvincible) {
                ctx.globalAlpha = flashAlpha;
                ctx.fillStyle = baseColor;
            } else {
                ctx.globalAlpha = 1;
                ctx.fillStyle = baseColor;
            }
        }

        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();
    }

    // 4. Draw Eyes on Head
    const head = snake[0];
    if (head) {
        const dx = mouseX - head.x;
        const dy = mouseY - head.y;
        const angle = Math.atan2(dy, dx);

        const eyeOffset = 4;
        const eyeRadius = 3;

        const rightEyeX = head.x + Math.cos(angle + 0.5) * eyeOffset * 1.5;
        const rightEyeY = head.y + Math.sin(angle + 0.5) * eyeOffset * 1.5;
        const leftEyeX = head.x + Math.cos(angle - 0.5) * eyeOffset * 1.5;
        const leftEyeY = head.y + Math.sin(angle - 0.5) * eyeOffset * 1.5;

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
        ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(rightEyeX, rightEyeY, eyeRadius / 2, 0, Math.PI * 2);
        ctx.arc(leftEyeX, leftEyeY, eyeRadius / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 5. Background Flash Overlay
    if (isFlashing) {
        const elapsed = Date.now() - flashStartTime;
        if (elapsed > 50) {
            isFlashing = false;
        } else {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 255, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
    }
}

// Helper to darken/lighten hex color
function adjustColor(col, amt) {
    if (col.startsWith('#')) {
        let usePound = false;
        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255;
        else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255;
        else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255;
        else if (g < 0) g = 0;

        let rStr = r.toString(16).padStart(2, '0');
        let gStr = g.toString(16).padStart(2, '0');
        let bStr = b.toString(16).padStart(2, '0');

        return (usePound ? "#" : "") + rStr + gStr + bStr;
    }
    return col;
}
