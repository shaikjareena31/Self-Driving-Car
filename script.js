(() => {
    "use strict";

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    const coinText = document.getElementById("coinCount");
    const startBtn = document.getElementById("startBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const message = document.getElementById("message");

    const overlay = document.getElementById("overlay");
    const overlayTitle = document.getElementById("overlayTitle");
    const overlayText = document.getElementById("overlayText");
    const overlayStart = document.getElementById("overlayStart");

    const W = canvas.width;
    const H = canvas.height;

    const road = {
        x: 180,
        width: 490
    };

    const laneWidth = road.width / 3;

    const lanes = [
        road.x + laneWidth / 2 - 25,
        road.x + laneWidth * 1.5 - 25,
        road.x + laneWidth * 2.5 - 25
    ];

    const player = {
        x: W / 2 - 25,
        y: H - 120,
        w: 50,
        h: 82,
        targetX: W / 2 - 25
    };

    let running = false;
    let paused = false;
    let gameOver = false;

    let coinsCollected = 0;
    let elapsed = 0;

    let lastTime = 0;
    let roadOffset = 0;
    let obstacleTimer = 0;
    let coinTimer = 0;

    let obstacles = [];
    let coins = [];

    let keyboardDirection = 0;
    let steerLeft = false;
    let steerRight = false;
    let animationId = null;

    // Load the highway background image.
    const highwayImage = new Image();
    highwayImage.src = "highway-bg.png";

    // Create the road drawing canvas.
    const roadCanvas = document.createElement("canvas");
    roadCanvas.width = W;
    roadCanvas.height = H;

    const roadCtx = roadCanvas.getContext("2d");

    function buildRoad() {
        roadCtx.fillStyle = "#082c3b";
        roadCtx.fillRect(0, 0, W, H);

        roadCtx.fillStyle = "#303030";
        roadCtx.fillRect(road.x, 0, road.width, H);

        roadCtx.fillStyle = "#414141";
        roadCtx.fillRect(
            road.x + 5,
            0,
            road.width - 10,
            H
        );

        roadCtx.fillStyle = "#00eaff";
        roadCtx.fillRect(road.x, 0, 4, H);
        roadCtx.fillRect(
            road.x + road.width - 4,
            0,
            4,
            H
        );

        // Roadside lights.
        for (let y = 28; y < H; y += 70) {
            roadCtx.fillStyle = "#00eaff";

            roadCtx.beginPath();
            roadCtx.arc(95, y, 4, 0, Math.PI * 2);
            roadCtx.fill();

            roadCtx.beginPath();
            roadCtx.arc(W - 95, y, 4, 0, Math.PI * 2);
            roadCtx.fill();
        }
    }

    buildRoad();

    function roundedRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(
            x + w,
            y + h,
            x + w - r,
            y + h
        );
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(
            x,
            y + h,
            x,
            y + h - r
        );
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
    }

    function drawRoad() {
        // Use the image when available.
        if (highwayImage.complete && highwayImage.naturalWidth > 0) {
            ctx.drawImage(highwayImage, 0, 0, W, H);
        } else {
            ctx.drawImage(roadCanvas, 0, 0);
        }

        // Moving lane markings.
        ctx.fillStyle = "#ffffff";

        const dashGap = 64;
        const dashHeight = 34;

        for (
            let y = (roadOffset % dashGap) - dashGap;
            y < H;
            y += dashGap
        ) {
            ctx.fillRect(
                road.x + laneWidth - 2,
                y,
                4,
                dashHeight
            );

            ctx.fillRect(
                road.x + laneWidth * 2 - 2,
                y,
                4,
                dashHeight
            );
        }
    }

    function drawCar(x, y, w, h, color, isPlayer = false) {
        ctx.save();

        // Car shadow.
        ctx.fillStyle = "#00000055";
        roundedRect(ctx, x + 4, y + 5, w, h, 10);
        ctx.fill();

        // Wheels.
        ctx.fillStyle = "#080b12";

        roundedRect(ctx, x - 4, y + 15, 8, 22, 3);
        ctx.fill();

        roundedRect(ctx, x + w - 4, y + 15, 8, 22, 3);
        ctx.fill();

        roundedRect(ctx, x - 4, y + h - 32, 8, 22, 3);
        ctx.fill();

        roundedRect(ctx, x + w - 4, y + h - 32, 8, 22, 3);
        ctx.fill();

        // Car body.
        const bodyGradient = ctx.createLinearGradient(
            x,
            y,
            x + w,
            y + h
        );

        bodyGradient.addColorStop(0, color);
        bodyGradient.addColorStop(0.5, color);
        bodyGradient.addColorStop(1, "#111827");

        ctx.fillStyle = bodyGradient;
        roundedRect(ctx, x, y, w, h, 11);
        ctx.fill();

        // Rear window.
        ctx.fillStyle = isPlayer ? "#0b3155" : "#1e293b";
        roundedRect(ctx, x + 7, y + 15, w - 14, h * 0.43, 7);
        ctx.fill();

        ctx.fillStyle = "#9befff";
        roundedRect(ctx, x + 10, y + 20, w - 20, 15, 4);
        ctx.fill();

        ctx.fillStyle = "#5cdfff";
        roundedRect(ctx, x + 10, y + 40, w - 20, 9, 3);
        ctx.fill();

        // Front lights.
        ctx.fillStyle = "#fff2a8";
        ctx.fillRect(x + 6, y + 5, 10, 5);
        ctx.fillRect(x + w - 16, y + 5, 10, 5);

        // Rear lights.
        ctx.fillStyle = "#ff1744";
        ctx.fillRect(x + 6, y + h - 7, 10, 4);
        ctx.fillRect(x + w - 16, y + h - 7, 10, 4);

        // Player car spoiler.
        if (isPlayer) {
            ctx.fillStyle = "#0757b8";
            roundedRect(ctx, x - 3, y + h - 15, w + 6, 7, 3);
            ctx.fill();
        }

        ctx.restore();
    }

    function drawCoin(coin) {
        ctx.save();

        const pulse = 1 + Math.sin(performance.now() / 120) * 0.08;

        ctx.translate(coin.x, coin.y);
        ctx.scale(pulse, pulse);

        // Coin glow.
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 16;

        const gradient = ctx.createRadialGradient(
            -4, -5, 2,
            0, 0, 15
        );

        gradient.addColorStop(0, "#fff9bd");
        gradient.addColorStop(0.45, "#ffd700");
        gradient.addColorStop(1, "#c47b00");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#fff2a8";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", 0, 1);

        ctx.restore();
    }

    function createObstacle() {
        if (obstacles.length >= 5) return;

        const lane = Math.floor(Math.random() * lanes.length);

        const colors = [
            "#ef4444",
            "#f97316",
            "#a855f7",
            "#22c55e",
            "#ec4899"
        ];

        obstacles.push({
            x: lanes[lane],
            y: -100,
            w: 50,
            h: 76,
            color: colors[
                Math.floor(Math.random() * colors.length)
            ]
        });
    }

    function createCoin() {
        if (coins.length >= 3) return;

        const lane = Math.floor(Math.random() * lanes.length);

        coins.push({
            x: lanes[lane] + 25,
            y: -25
        });
    }

    function updatePlayer(dt) {
        // Hand tracking controls.
        if (
            window.handDetected &&
            Number.isFinite(window.fingerX)
        ) {
            player.targetX =
                road.x +
                window.fingerX * (road.width - player.w);
        } else {
            // Keyboard and touch controls.
            const direction =
                keyboardDirection ||
                (steerLeft ? -1 : steerRight ? 1 : 0);

            if (direction !== 0) {
                player.targetX += direction * 340 * dt;
            }
        }

        // Keep the car inside the road.
        player.targetX = Math.max(
            road.x + 8,
            Math.min(
                road.x + road.width - player.w - 8,
                player.targetX
            )
        );

        // Smooth steering.
        const smoothing = 1 - Math.exp(-12 * dt);

        player.x +=
            (player.targetX - player.x) * smoothing;
    }

    function overlaps(a, b) {
        const inset = 8;

        return (
            a.x + inset < b.x + b.w - inset &&
            a.x + a.w - inset > b.x + inset &&
            a.y + inset < b.y + b.h - inset &&
            a.y + a.h - inset > b.y + inset
        );
    }

    function updateObjects(dt) {
        // Speed increases gradually but is not displayed.
        const speedLevel = Math.min(
            8,
            1 + Math.floor(elapsed / 12)
        );

        const movement = (210 + speedLevel * 35) * dt;

        roadOffset = (roadOffset + movement) % 64;

        // Update traffic.
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];

            obstacle.y += movement;

            if (overlaps(player, obstacle)) {
                finishGame();
                return;
            }

            if (obstacle.y > H + 100) {
                obstacles.splice(i, 1);
            }
        }

        // Update and collect coins.
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];

            coin.y += movement;

            const dx =
                player.x + player.w / 2 - coin.x;

            const dy =
                player.y + player.h / 2 - coin.y;

            if (Math.hypot(dx, dy) < 43) {
                coins.splice(i, 1);

                coinsCollected++;
                coinText.textContent = coinsCollected;

                message.textContent = "🪙 Coin collected!";

                continue;
            }

            if (coin.y > H + 30) {
                coins.splice(i, 1);
            }
        }
    }

    function render() {
        drawRoad();

        coins.forEach(drawCoin);

        obstacles.forEach(obstacle => {
            drawCar(
                obstacle.x,
                obstacle.y,
                obstacle.w,
                obstacle.h,
                obstacle.color
            );
        });

        drawCar(
            player.x,
            player.y,
            player.w,
            player.h,
            "#087dff",
            true
        );
    }

    function loop(timestamp) {
        if (!running) return;

        if (paused) {
            lastTime = timestamp;
            animationId = requestAnimationFrame(loop);
            return;
        }

        if (!lastTime) lastTime = timestamp;

        // Avoid large movement after tab switching.
        const dt = Math.min(
            (timestamp - lastTime) / 1000,
            0.04
        );

        lastTime = timestamp;
        elapsed += dt;
        obstacleTimer += dt;
        coinTimer += dt;

        updatePlayer(dt);
        updateObjects(dt);

        if (!running) {
            render();
            return;
        }

        const speedLevel = Math.min(
            8,
            1 + Math.floor(elapsed / 12)
        );

        const obstacleInterval = Math.max(
            0.8,
            1.65 - speedLevel * 0.07
        );

        if (obstacleTimer > obstacleInterval) {
            obstacleTimer = 0;
            createObstacle();
        }

        if (coinTimer > 2) {
            coinTimer = 0;
            createCoin();
        }

        render();

        animationId = requestAnimationFrame(loop);
    }

    function showOverlay(title, text, buttonText) {
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        overlayStart.textContent = buttonText;
        overlay.classList.remove("hidden");
    }

    function hideOverlay() {
        overlay.classList.add("hidden");
    }

    function startGame() {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
        }

        coinsCollected = 0;
        elapsed = 0;

        obstacleTimer = 0;
        coinTimer = 0;
        roadOffset = 0;

        obstacles = [];
        coins = [];

        player.x = W / 2 - player.w / 2;
        player.targetX = player.x;

        running = true;
        paused = false;
        gameOver = false;
        lastTime = 0;

        coinText.textContent = "0";

        startBtn.disabled = true;
        startBtn.textContent = "▶ Start Game";

        pauseBtn.disabled = false;
        pauseBtn.textContent = "⏸ Pause Game";

        message.textContent =
            "Drive carefully and collect coins!";

        hideOverlay();

        createObstacle();
        createCoin();

        animationId = requestAnimationFrame(loop);
    }

    function togglePause() {
        if (!running || gameOver) return;

        paused = !paused;

        pauseBtn.textContent = paused
            ? "▶ Resume Game"
            : "⏸ Pause Game";

        message.textContent = paused
            ? "Game paused."
            : "Game resumed.";

        if (!paused) {
            lastTime = 0;
        }
    }

    function finishGame() {
        running = false;
        gameOver = true;
        paused = false;

        startBtn.disabled = false;
        startBtn.textContent = "🔄 Restart Game";

        pauseBtn.disabled = true;

        message.textContent =
            `Game over! Coins collected: ${coinsCollected}.`;

        showOverlay(
            "Game Over!",
            `You collected ${coinsCollected} coins!`,
            "🔄 Play Again"
        );
    }

    // Game buttons.
    startBtn.addEventListener("click", startGame);
    overlayStart.addEventListener("click", startGame);
    pauseBtn.addEventListener("click", togglePause);

    // Keyboard steering.
    document.addEventListener("keydown", event => {
        const key = event.key.toLowerCase();

        if (
            key === "arrowleft" ||
            key === "arrowright" ||
            key === " "
        ) {
            event.preventDefault();
        }

        if (key === "arrowleft" || key === "a") {
            keyboardDirection = -1;
        }

        if (key === "arrowright" || key === "d") {
            keyboardDirection = 1;
        }

        if (key === " " && !event.repeat) {
            togglePause();
        }
    });

    document.addEventListener("keyup", event => {
        const key = event.key.toLowerCase();

        if (
            key === "arrowleft" ||
            key === "arrowright" ||
            key === "a" ||
            key === "d"
        ) {
            keyboardDirection = 0;
        }
    });

    // Mobile touch controls.
    function bindHoldButton(id, direction) {
        const button = document.getElementById(id);

        const press = event => {
            event.preventDefault();

            if (direction < 0) {
                steerLeft = true;
                steerRight = false;
            } else {
                steerRight = true;
                steerLeft = false;
            }
        };

        const release = () => {
            steerLeft = false;
            steerRight = false;
        };

        button.addEventListener("pointerdown", press);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointerleave", release);
        button.addEventListener("pointercancel", release);
    }

    bindHoldButton("leftBtn", -1);
    bindHoldButton("rightBtn", 1);

    window.addEventListener("blur", () => {
        keyboardDirection = 0;
        steerLeft = false;
        steerRight = false;
    });

    // Draw the initial screen.
    render();
})();
