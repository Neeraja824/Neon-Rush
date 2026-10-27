
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const scoreEl = $("score");
const bestEl = $("best");
const coinsEl = $("coins");
const distanceEl = $("distance");
const speedText = $("speedText");
const bestMessage = $("bestMessage");
const overlay = $("overlay");
const overlayTitle = $("overlayTitle");
const overlayText = $("overlayText");
const overlayIcon = $("overlayIcon");
const overlayEyebrow = $("overlayEyebrow");
const overlayBtn = $("overlayBtn");
const overlayBtnLabel = $("overlayBtnLabel");
const startBtn = $("startBtn");
const startLabel = $("startLabel");
const pauseBtn = $("pauseBtn");
const soundBtn = $("soundBtn");
const newRecord = $("newRecord");

const W = 900;
const H = 450;
const GROUND = 365;
const GRAVITY = 2100;
const JUMP_POWER = 560;

canvas.width = W;
canvas.height = H;

let state = "ready";
let player;
let obstacles = [];
let coins = [];
let particles = [];
let buildings = [];

let score = 0;
let distance = 0;
let collectedCoins = 0;
let totalCoins = Number(localStorage.getItem("neonRushTotalCoins")) || 0;
let speed = 340;
let obstacleTimer = 0;
let coinTimer = 0;
let elapsed = 0;
let lastTime = 0;
let soundEnabled = true;
let audioContext = null;
let bestScore = loadBestScore();
let runBest = false;

function loadBestScore() {
    try {
        return Math.max(
            0,
            Number(localStorage.getItem("neonRushBest")) || 0
        );
    } catch {
        return 0;
    }
}

function saveBestScore(value) {
    try {
        localStorage.setItem("neonRushBest", String(value));
        return true;
    } catch {
        return false;
    }
}

function formatNumber(value) {
    return Math.floor(value).toLocaleString("en-US");
}


function updateHUD() {
    scoreEl.textContent = formatNumber(score);
    bestEl.textContent = formatNumber(bestScore);
    coinsEl.textContent = formatNumber(collectedCoins);
    distanceEl.textContent = formatNumber(distance);

    const totalCoinsEl = document.getElementById("totalCoins");

    if (totalCoinsEl) {
        totalCoinsEl.textContent = formatNumber(totalCoins);
    }

    speedText.textContent =
        `Speed: ${(speed / 340).toFixed(1)}x`;

    bestMessage.textContent = runBest
        ? "New personal record!"
        : "Your next record awaits";
}


function initializeBuildings() {
    buildings = [];

    let x = 0;

    while (x < W + 100) {
        const width = 35 + Math.random() * 65;
        const height = 70 + Math.random() * 180;

        buildings.push({
            x,
            width,
            height,
            windows: Math.random() > 0.5 ? "#32b9ff" : "#9c83ff",
            seed: Math.random()
        });

        x += width + 8;
    }
}

function resetGame() {
    player = {
        x: 125,
        y: GROUND - 60,
        width: 34,
        height: 60,
        vy: 0,
        grounded: true,
        runPhase: 0
    };

    obstacles = [];
    coins = [];
    particles = [];

    powerUps = [];
    shieldActive = false;
    shieldUsed = false;
    shieldTime = 0;
    magnetActive = false;
    magnetTime = 0;
    powerUpTimer = 8;

    score = 0;
    distance = 0;
    collectedCoins = 0;
    speed = 340;
    obstacleTimer = 1.5;
    coinTimer = 1.7;
    elapsed = 0;
    runBest = false;

    newRecord.hidden = true;

    updateHUD();
}

function showOverlay(mode, title, message, buttonText) {
    overlayTitle.innerHTML = title;
    overlayText.textContent = message;
    overlayBtnLabel.textContent = buttonText;

    if (mode === "ready") {
        overlayIcon.textContent = "ϟ";
        overlayEyebrow.textContent = "YOUR ADVENTURE BEGINS";
    } else if (mode === "paused") {
        overlayIcon.textContent = "Ⅱ";
        overlayEyebrow.textContent = "TAKE A BREATHER";
    } else {
        overlayIcon.textContent = runBest ? "♛" : "↗";
        overlayEyebrow.textContent = runBest
            ? "A NEW PERSONAL RECORD"
            : "EVERY RUN MAKES YOU BETTER";
    }

    overlay.classList.remove("hidden");
}

function hideOverlay() {
    overlay.classList.add("hidden");
}

function startGame() {
    initAudio();
    resetGame();
    initializeBuildings();

    state = "running";
    pauseBtn.disabled = false;
    pauseBtn.textContent = "Ⅱ Pause";
    startLabel.textContent = "RESTART RUN";

    hideOverlay();
    lastTime = performance.now();
}

function finishGame() {
    if (state !== "running") return;

    state = "over";

    pauseBtn.disabled = true;
    pauseBtn.textContent = "Ⅱ Pause";

    runBest = Math.floor(score) > bestScore;

    if (runBest) {
        bestScore = Math.floor(score);
        saveBestScore(bestScore);
        newRecord.hidden = false;
    } else {
        newRecord.hidden = true;
    }

    updateHUD();
    sound(150, 0.22, "sawtooth");

    showOverlay(
        "over",
        runBest ? 'NEW <span>RECORD!</span>' : 'RUN <span>OVER.</span>',
        `Score: ${formatNumber(score)} · Distance: ${formatNumber(distance)} m · Coins: ${collectedCoins} · Best: ${formatNumber(bestScore)}`,
        "PLAY AGAIN →"
    );

    startLabel.textContent = "PLAY AGAIN";
}

function jump() {
    if (state !== "running") return;
    if (!player.grounded) return;

    player.vy = -JUMP_POWER;
    player.grounded = false;

    addParticles(
        player.x + player.width / 2,
        GROUND - 3,
        "#32b9ff",
        7
    );

    sound(390, 0.07, "sine");
}

function togglePause() {
    if (state === "running") {
        state = "paused";
        pauseBtn.textContent = "▶ Resume";

        showOverlay(
            "paused",
            'GAME <span>PAUSED</span>',
            "Your run is paused. Resume when you're ready.",
            "RESUME →"
        );
    } else if (state === "paused") {
        state = "running";
        pauseBtn.textContent = "Ⅱ Pause";

        hideOverlay();
        lastTime = performance.now();
    }
}

function initAudio() {
    if (!soundEnabled) return;

    try {
        if (!audioContext) {
            audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
    } catch { }
}

function sound(frequency, duration = 0.1, type = "sine") {
    if (!soundEnabled || !audioContext) return;

    try {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.045, audioContext.currentTime);

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch { }
}

function addParticles(x, y, color, amount = 8) {
    for (let i = 0; i < amount; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 220,
            vy: (Math.random() - 0.7) * 220,
            life: 0.3 + Math.random() * 0.4,
            maxLife: 0.7,
            color,
            size: 2 + Math.random() * 4
        });
    }
}

function spawnObstacle() {
    const tall = Math.random() > 0.5;
    const width = tall ? 33 : 43;
    const height = tall ? 62 : 38;

    obstacles.push({
        x: W + 20,
        y: GROUND - height,
        width,
        height,
        type: tall ? "barrier" : "crate",
        color: Math.random() > 0.5 ? "#ff5b83" : "#a78bfa"
    });
}

function spawnCoins() {
    const count = 4 + Math.floor(Math.random() * 2);

    for (let i = 0; i < count; i++) {
        coins.push({
            x: canvas.width + 40 + i * 40,
            y: GROUND - 78 - Math.random() * 18,
            radius: 11,
            wobble: Math.random() * Math.PI * 2
        });
    }
}

function spawnPowerUp() {
    const type = Math.random() < 0.5 ? "shield" : "magnet";

    powerUps.push({
        x: canvas.width + 40,
        y: GROUND - 100 - Math.random() * 50,
        width: 30,
        height: 30,
        type,
        pulse: 0
    });
}

function intersects(a, b) {
    return (
        a.x + 5 < b.x + b.width - 4 &&
        a.x + a.width - 5 > b.x + 4 &&
        a.y + 5 < b.y + b.height - 3 &&
        a.y + a.height > b.y + 4
    );
}

function update(dt) {
    if (state !== "running") return;

    elapsed += dt;

    speed = Math.min(690, 340 + elapsed * 5.2);
    distance += speed * dt / 10;
    score += speed * dt / 10;

    player.runPhase += dt * speed * 0.025;

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    if (player.y + player.height >= GROUND) {
        player.y = GROUND - player.height;
        player.vy = 0;
        player.grounded = true;
    }

    obstacleTimer -= dt;
    coinTimer -= dt;
    powerUpTimer -= dt;

    if (powerUpTimer <= 0) {
        spawnPowerUp();
        powerUpTimer = 8 + Math.random() * 5;
    }

    if (obstacleTimer <= 0) {
        spawnObstacle();

        obstacleTimer = Math.max(
            0.85,
            1.55 + Math.random() * 0.65 - elapsed * 0.003
        );
    }

    if (coinTimer <= 0) {
        spawnCoins();
        coinTimer = 1.9 + Math.random() * 1.5;
    }

    for (const obstacle of obstacles) {
        obstacle.x -= speed * dt;

        if (intersects(player, obstacle)) {
            if (shieldActive && !shieldUsed) {
                shieldActive = false;
                shieldUsed = true;
                shieldTime = 0;

                addParticles(
                    player.x + player.width / 2,
                    player.y + player.height / 2,
                    "#32b9ff",
                    18
                );

                continue;
            }

            addParticles(
                player.x + player.width / 2,
                player.y + player.height / 2,
                "#ff6487",
                22
            );

            finishGame();
            return;
        }
    }

    if (shieldActive) {
        shieldTime -= dt;

        if (shieldTime <= 0) {
            shieldActive = false;
        }
    }

    if (magnetActive) {
        magnetTime -= dt;

        if (magnetTime <= 0) {
            magnetActive = false;
        }
    }

    for (const coin of coins) {
        coin.x -= speed * dt;

        if (coin.collected) continue;

        const dx = player.x + player.width / 2 - coin.x;
        const dy = player.y + player.height / 2 - coin.y;
        const distanceToCoin = Math.hypot(dx, dy);

        if (magnetActive && distanceToCoin < 180) {
            coin.x += dx * dt * 5;
            coin.y += dy * dt * 5;
        }

        const newDx = player.x + player.width / 2 - coin.x;
        const newDy = player.y + player.height / 2 - coin.y;

        if (Math.hypot(newDx, newDy) < 25) {
            coin.collected = true;
            collectedCoins++;
            totalCoins++;
            localStorage.setItem(
                "neonRushTotalCoins",
                totalCoins
            );

            score += 10;

            addParticles(coin.x, coin.y, "#ffc95c", 9);
            sound(720 + Math.random() * 150, 0.08);
        }
    }

    for (const powerUp of powerUps) {
        powerUp.x -= speed * dt;
        powerUp.pulse += dt * 5;

        if (intersects(player, powerUp)) {
            if (powerUp.type === "shield") {
                shieldActive = true;
                shieldUsed = false;
                shieldTime = 8;

                addParticles(
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2,
                    "#32b9ff",
                    14
                );
            } else if (powerUp.type === "magnet") {
                magnetActive = true;
                magnetTime = 8;

                addParticles(
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2,
                    "#ff5de4",
                    14
                );
            }

            powerUp.collected = true;
            sound(900, 0.12);
        }
    }

    for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
    }

    obstacles = obstacles.filter(o => o.x + o.width > -20);
    coins = coins.filter(c => c.x > -30 && !c.collected);
    particles = particles.filter(p => p.life > 0);

    powerUps = powerUps.filter(
        powerUp => powerUp.x + powerUp.width > 0 && !powerUp.collected
    );

    updateHUD();
}

function drawBackground(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);

    sky.addColorStop(0, "#0b1428");
    sky.addColorStop(0.48, "#263657");
    sky.addColorStop(0.76, "#76516b");
    sky.addColorStop(1, "#121c31");

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(
        W * 0.65, 170, 5,
        W * 0.65, 170, 270
    );

    glow.addColorStop(0, "#ffb87c55");
    glow.addColorStop(1, "#ffb87c00");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffd8a0";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(W * 0.65, 170, 37, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 48; i++) {
        const x = (i * 197 + 31) % W;
        const y = (i * 73 + 17) % 180;

        ctx.fillStyle = i % 2 ? "#ffffff77" : "#8bdcff77";
        ctx.fillRect(x, y, 2, 2);
    }

    for (const b of buildings) {
        const y = GROUND - b.height;

        ctx.fillStyle = "#111c32";
        ctx.fillRect(b.x, y, b.width, b.height);

        ctx.fillStyle = "#273653";
        ctx.fillRect(b.x + 4, y + 5, 2, b.height - 5);

        for (let wy = y + 12; wy < GROUND - 12; wy += 18) {
            for (let wx = b.x + 10; wx < b.x + b.width - 6; wx += 14) {
                const lit =
                    Math.sin(wx * 3 + wy * 7 + b.seed * 30) > 0.1;

                if (lit) {
                    ctx.fillStyle = b.windows;
                    ctx.globalAlpha =
                        0.35 + (Math.sin(wx + wy) + 1) * 0.2;

                    ctx.fillRect(wx, wy, 4, 7);
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    const horizon = ctx.createLinearGradient(
        0, GROUND - 30, 0, GROUND + 20
    );

    horizon.addColorStop(0, "#32b9ff00");
    horizon.addColorStop(1, "#32b9ff20");

    ctx.fillStyle = horizon;
    ctx.fillRect(0, GROUND - 30, W, 50);

    ctx.fillStyle = "#111c30";
    ctx.fillRect(0, GROUND, W, H - GROUND);

    ctx.strokeStyle = "#32b9ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#32b9ff";
    ctx.shadowBlur = 13;

    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    ctx.lineTo(W, GROUND);
    ctx.stroke();

    ctx.shadowBlur = 0;

    for (let i = 0; i < 12; i++) {
        const x =
            ((i * 110 - time * speed * 0.65) % (W + 110) + W + 110) %
            (W + 110);

        ctx.fillStyle = "#a8dfff77";
        ctx.fillRect(x, GROUND + 33, 48, 3);
    }
}

function drawRunner() {
    const p = player;
    const bob = p.grounded ? Math.sin(p.runPhase) * 2 : 0;
    const x = p.x;
    const y = p.y + bob;

    ctx.save();
    ctx.translate(x + p.width / 2, y);

    ctx.shadowColor = "#32b9ff";
    ctx.shadowBlur = 13;
    ctx.strokeStyle = "#32b9ff";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";

    const legSwing = p.grounded
        ? Math.sin(p.runPhase) * 11
        : 5;

    ctx.beginPath();
    ctx.moveTo(-6, 43);
    ctx.lineTo(-10 + legSwing, 54);
    ctx.lineTo(-17 + legSwing, 59);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(6, 43);
    ctx.lineTo(10 - legSwing, 53);
    ctx.lineTo(17 - legSwing, 59);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#102844";
    ctx.fillRect(-12, 20, 24, 27);

    ctx.fillStyle = "#32b9ff";
    ctx.fillRect(-10, 20, 20, 24);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Inter";
    ctx.textAlign = "center";
    ctx.fillText("ϟ", 0, 38);

    ctx.strokeStyle = "#32b9ff";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(-9, 25);
    ctx.lineTo(-15, 35);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(9, 25);
    ctx.lineTo(15, 32);
    ctx.stroke();

    ctx.fillStyle = "#d9a782";
    ctx.beginPath();
    ctx.arc(0, 12, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#18253c";
    ctx.beginPath();
    ctx.arc(0, 9, 11, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-11, 6, 21, 5);

    ctx.fillStyle = "#e9f6ff";
    ctx.fillRect(3, 12, 5, 2);

    ctx.restore();
}

function drawObstacle(o) {
    ctx.save();

    ctx.shadowColor = o.color;
    ctx.shadowBlur = 14;

    ctx.fillStyle = "#111b2d";
    ctx.fillRect(o.x, o.y, o.width, o.height);

    ctx.strokeStyle = o.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.width, o.height);

    ctx.shadowBlur = 0;
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x + 5, o.y + 6, o.width - 10, 5);

    ctx.fillStyle = "#ffffffaa";
    ctx.fillRect(o.x + 6, o.y + 15, 3, o.height - 21);

    ctx.restore();
}

function drawCoin(coin, time) {
    const scale =
        0.82 + Math.abs(Math.sin(time * 0.006 + coin.phase)) * 0.18;

    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.scale(scale, 1);

    ctx.shadowColor = "#ffc95c";
    ctx.shadowBlur = 16;

    const gradient = ctx.createLinearGradient(-10, -10, 10, 10);
    gradient.addColorStop(0, "#fff4bd");
    gradient.addColorStop(0.5, "#ffc95c");
    gradient.addColorStop(1, "#d98716");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff1a6";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#79500b";
    ctx.font = "bold 12px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);

    ctx.restore();
}


function drawPowerUp(powerUp) {
    const centerX = powerUp.x + powerUp.width / 2;
    const centerY = powerUp.y + powerUp.height / 2;
    const pulse = Math.sin(powerUp.pulse) * 3;
    const radius = 16 + pulse;

    ctx.save();

    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;

    if (powerUp.type === "shield") {
        ctx.shadowColor = "#32b9ff";
        ctx.strokeStyle = "#32b9ff";
        ctx.fillStyle = "#153b60";

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("S", centerX, centerY);
    } else {
        ctx.shadowColor = "#ff5de4";
        ctx.strokeStyle = "#ff5de4";
        ctx.fillStyle = "#54214f";

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("M", centerX, centerY);
    }

    ctx.restore();
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.globalAlpha = 1;
}

function render(time = 0) {
    drawBackground(time);

    for (const coin of coins) {
        drawCoin(coin, time);
    }

    for (const powerUp of powerUps) {
        drawPowerUp(powerUp);
    }

    for (const obstacle of obstacles) {
        drawObstacle(obstacle);
    }

    if (player) {
        drawRunner();
    }

    drawParticles();

    if (state === "ready") {
        ctx.fillStyle = "#d5e8ff";
        ctx.textAlign = "center";
        ctx.font = "600 12px Inter";
        ctx.fillText("JUMP INTO THE ACTION", W / 2, H - 28);
    }
}

function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, 0.035);
    lastTime = time;

    update(dt);
    render(time);

    requestAnimationFrame(gameLoop);
}

function handlePrimaryAction() {
    if (state === "paused") {
        togglePause();
    } else {
        startGame();

        $("play").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

startBtn.addEventListener("click", handlePrimaryAction);

overlayBtn.addEventListener("click", () => {
    if (state === "paused") {
        togglePause();
    } else {
        startGame();
    }
});

pauseBtn.addEventListener("click", togglePause);

soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundBtn.textContent = soundEnabled
        ? "♫ Sound On"
        : "♫ Sound Off";

    if (soundEnabled) {
        initAudio();
    }
});

document.addEventListener("keydown", event => {
    if (event.code === "ArrowUp" || event.code === "Space") {
        event.preventDefault();

        if (event.repeat) return;

        if (state === "running") {
            jump();
        } else if (state === "paused" && event.code === "Space") {
            resumeGame();
        }
    }

    if (
        event.code === "KeyP" ||
        event.code === "Escape"
    ) {
        if (state === "running" || state === "paused") {
            event.preventDefault();
            togglePause();
        }
    }
});

canvas.addEventListener("pointerdown", event => {
    event.preventDefault();

    if (state === "running") {
        jump();
    } else if (state === "ready" || state === "over") {
        startGame();
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") {
        togglePause();
    }
});

resetGame();
initializeBuildings();

showOverlay(
    "ready",
    'READY TO <span>RUSH?</span>',
    "Jump over obstacles and collect coins to build your score.",
    "START GAME →"
);

requestAnimationFrame(time => {
    lastTime = time;
    gameLoop(time);
});
