const BOARD_SIZE = 100;
const CANVAS_SIZE = 700;
const VIEWPORT_CELLS = 25;
const CELL_SIZE = CANVAS_SIZE / VIEWPORT_CELLS;
const BASE_MOVE_INTERVAL = 400;
const MIN_MOVE_INTERVAL = 100;
const BASE_SPEED_STEP_INTERVAL = 4000;
const BASE_SPEED_STEP_MULTIPLIER = 1.1;
const BOOST_MULTIPLIER = 1.3;
const BOOST_DURATION = 5000;
const BULLET_EFFECT_DURATION = 3000;
const BULLET_FIRE_INTERVAL = 600;
const INITIAL_ITEM_COUNT = 5;
const ITEM_LIMIT = 40;
const MIN_SPAWN_BATCH = 1;
const MAX_SPAWN_BATCH = 3;
const MIN_SPAWN_INTERVAL = 1000;
const MAX_SPAWN_INTERVAL = 3000;
const STANDARD_AGGRO_RANGE = 5;
const EXPERT_AGGRO_RANGE = 10;
const NPC_ATTACK_START_TIME = 15000;

const DIRECTION_VECTORS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

const BULLET_DIRECTION_VECTORS = {
    up: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
    ],
    down: [
        { x: -1, y: 1 },
        { x: 1, y: 1 },
    ],
    left: [
        { x: -1, y: -1 },
        { x: -1, y: 1 },
    ],
    right: [
        { x: 1, y: -1 },
        { x: 1, y: 1 },
    ],
};

const LEFT_TURN = {
    up: "left",
    left: "down",
    down: "right",
    right: "up",
};

const RIGHT_TURN = {
    up: "right",
    right: "down",
    down: "left",
    left: "up",
};

const OPPOSITE = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
};

const KEY_TO_DIRECTION = {
    w: "up",
    a: "left",
    s: "down",
    d: "right",
};

const STATUS_LABELS = {
    idle: "待开始",
    running: "进行中",
    paused: "已暂停",
    over: "已结束",
};

const ITEM_TYPES = {
    grow: {
        color: "#4fb857",
        score: 1,
        weight: 0.7,
    },
    boost: {
        color: "#f1c53c",
        score: 2,
        weight: 0.2,
    },
    bullet: {
        color: "#4a7df0",
        score: 2,
        weight: 0.1,
    },
};

const NPC_TIER_SETTINGS = {
    dumb: {
        label: "傻瓜档",
        selfCrashChance: 0.35,
        skipItemChance: 0.3,
        lookaheadDepth: 1,
        colors: { head: "#a83a3a", body: "#de7474" },
    },
    standard: {
        label: "标准档",
        selfCrashChance: 0.05,
        skipItemChance: 0.1,
        lookaheadDepth: 2,
        colors: { head: "#275f8d", body: "#6ca6d7" },
    },
    expert: {
        label: "高手档",
        selfCrashChance: 0,
        skipItemChance: 0,
        lookaheadDepth: 3,
        colors: { head: "#4f296b", body: "#9a6bc7" },
    },
};

const NPC_TIER_SEQUENCE = [
    "dumb",
    "dumb",
    "dumb",
    "standard",
    "standard",
    "standard",
    "expert",
    "expert",
];

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

const statusText = document.getElementById("statusText");
const scoreText = document.getElementById("scoreText");
const speedText = document.getElementById("speedText");
const boostText = document.getElementById("boostText");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayBody = document.getElementById("overlayBody");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");
const exitButton = document.getElementById("exitButton");

const game = {
    state: "idle",
    player: null,
    npcs: [],
    items: [],
    bullets: [],
    score: 0,
    lastTimestamp: 0,
    spawnAccumulator: 0,
    elapsedRunningTime: 0,
    nextSpawnInterval: randomInt(MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL),
    animationFrameId: null,
};

startButton.addEventListener("click", startNewGame);
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
restartButton.addEventListener("click", startNewGame);
exitButton.addEventListener("click", exitGame);
window.addEventListener("keydown", handleKeyDown);

renderFrame();
syncUi();
showOverlay("Ready", "准备开始", "点击“开始游戏”进入默认模式。", true);

function startNewGame() {
    resetGameState();
    game.state = "running";
    game.lastTimestamp = performance.now();
    hideOverlay();
    syncUi();
    startLoop();
}

function resetGameState() {
    game.items = [];
    game.bullets = [];
    game.score = 0;
    game.spawnAccumulator = 0;
    game.elapsedRunningTime = 0;
    game.nextSpawnInterval = randomInt(MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);
    game.player = createSnakeEntity("player", 0, null);
    game.npcs = [];

    for (let index = 0; index < NPC_TIER_SEQUENCE.length; index += 1) {
        const npc = createSnakeEntity("npc", index, NPC_TIER_SEQUENCE[index]);
        if (npc) {
            game.npcs.push(npc);
        }
    }

    seedItems(INITIAL_ITEM_COUNT, null);
    ensureViewportItems();
}

function createSnakeEntity(kind, index, tier) {
    const spawnData = findSnakeSpawnData();
    if (!spawnData) {
        return null;
    }

    const colors = kind === "player"
        ? { head: "#274d37", body: "#3b7250" }
        : NPC_TIER_SETTINGS[tier].colors;

    return {
        id: kind === "player" ? "player" : `npc-${tier}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind,
        tier,
        segments: spawnData.segments,
        previousSegments: cloneSegments(spawnData.segments),
        direction: spawnData.direction,
        pendingAbsoluteDirection: null,
        moveAccumulator: 0,
        boostRemaining: 0,
        bulletEffectRemaining: 0,
        bulletFireAccumulator: 0,
        straightSteps: 0,
        selfCrashEnabled: kind === "npc" && Math.random() < NPC_TIER_SETTINGS[tier].selfCrashChance,
        colors,
    };
}

function findSnakeSpawnData() {
    const maxAttempts = 800;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const direction = pickRandomDirection();
        const vector = DIRECTION_VECTORS[direction];
        const headX = randomInt(2, BOARD_SIZE - 3);
        const headY = randomInt(2, BOARD_SIZE - 3);
        const segments = [];
        let valid = true;

        for (let index = 0; index < 3; index += 1) {
            const segment = {
                x: headX - vector.x * index,
                y: headY - vector.y * index,
            };

            if (isOutOfBounds(segment) || isAnySnakeAt(segment) || isItemAt(segment) || isBulletAt(segment)) {
                valid = false;
                break;
            }

            segments.push(segment);
        }

        if (!valid) {
            continue;
        }

        if (segments.some((segment) => isTooCloseToAnySnake(segment))) {
            continue;
        }

        return { direction, segments };
    }

    return null;
}

function pickRandomDirection() {
    const directions = Object.keys(DIRECTION_VECTORS);
    return directions[randomInt(0, directions.length - 1)];
}

function startLoop() {
    cancelLoop();
    game.animationFrameId = requestAnimationFrame(tick);
}

function cancelLoop() {
    if (game.animationFrameId !== null) {
        cancelAnimationFrame(game.animationFrameId);
        game.animationFrameId = null;
    }
}

function tick(timestamp) {
    const delta = timestamp - game.lastTimestamp;
    game.lastTimestamp = timestamp;

    if (game.state === "running") {
        updateRunningState(delta);
    }

    renderFrame();
    syncUi();

    if (game.state === "running") {
        game.animationFrameId = requestAnimationFrame(tick);
    }
}

function updateRunningState(delta) {
    game.spawnAccumulator += delta;
    game.elapsedRunningTime += delta;

    for (const snake of getAllSnakes()) {
        snake.moveAccumulator += delta;

        if (snake.boostRemaining > 0) {
            snake.boostRemaining = Math.max(0, snake.boostRemaining - delta);
        }

        if (snake.bulletEffectRemaining > 0) {
            snake.bulletEffectRemaining = Math.max(0, snake.bulletEffectRemaining - delta);
            snake.bulletFireAccumulator += delta;

            while (snake.bulletFireAccumulator >= BULLET_FIRE_INTERVAL) {
                snake.bulletFireAccumulator -= BULLET_FIRE_INTERVAL;
                spawnBulletFromSnake(snake);

                if (snake.bulletEffectRemaining <= 0) {
                    break;
                }
            }
        } else {
            snake.bulletFireAccumulator = 0;
        }
    }

    for (const bullet of game.bullets) {
        bullet.moveAccumulator += delta;
    }

    let hasPendingStep = true;
    while (hasPendingStep && game.state === "running") {
        hasPendingStep = false;

        const readySnakes = getAllSnakes().filter((snake) => snake.moveAccumulator >= getSnakeMoveInterval(snake));
        if (readySnakes.length > 0) {
            for (const snake of readySnakes) {
                snake.moveAccumulator -= getSnakeMoveInterval(snake);
            }

            stepReadySnakes(readySnakes);
            hasPendingStep = true;
        }

        if (game.state !== "running") {
            break;
        }

        for (const bullet of [...game.bullets]) {
            while (bullet.moveAccumulator >= bullet.moveInterval && game.bullets.includes(bullet)) {
                bullet.moveAccumulator -= bullet.moveInterval;
                stepBullet(bullet);
                hasPendingStep = true;

                if (game.state !== "running") {
                    break;
                }
            }

            if (game.state !== "running") {
                break;
            }
        }
    }

    ensureNpcCount();
    processSpawning();
    ensureViewportItems();
}

function stepReadySnakes(readySnakes) {
    const plans = readySnakes.map((snake) => {
        const nextDirection = snake.kind === "player" ? resolvePlayerDirection() : resolveNpcDirection(snake);
        const nextHead = getNextPosition(snake.segments[0], nextDirection);
        const item = getItemAt(nextHead);

        return {
            snake,
            nextDirection,
            nextHead,
            item,
            willGrow: item?.type === "grow",
            ignoredCollisionSnakeIds: [],
            canceled: false,
        };
    });

    resolveHeadOnCollisions(plans);

    for (const plan of plans) {
        if (plan.canceled || game.state !== "running") {
            continue;
        }

        stepSnake(plan.snake, plan);
    }
}

function resolveHeadOnCollisions(plans) {
    for (let index = 0; index < plans.length; index += 1) {
        const current = plans[index];
        if (current.canceled) {
            continue;
        }

        for (let compareIndex = index + 1; compareIndex < plans.length; compareIndex += 1) {
            const other = plans[compareIndex];
            if (other.canceled) {
                continue;
            }

            const sameTarget = isSamePosition(current.nextHead, other.nextHead);
            const swappedHeads = isSamePosition(current.nextHead, other.snake.segments[0])
                && isSamePosition(other.nextHead, current.snake.segments[0]);

            if (!sameTarget && !swappedHeads) {
                continue;
            }

            const currentLength = current.snake.segments.length;
            const otherLength = other.snake.segments.length;

            if (currentLength === otherLength) {
                current.canceled = true;
                other.canceled = true;
                handleSnakeDeath(current.snake, { type: "head-on", target: other.snake });
                if (game.state !== "running") {
                    return;
                }
                handleSnakeDeath(other.snake, { type: "head-on", target: current.snake });
                continue;
            }

            const winner = currentLength > otherLength ? current : other;
            const loser = winner === current ? other : current;
            loser.canceled = true;
            winner.ignoredCollisionSnakeIds.push(loser.snake.id);
            handleSnakeDeath(loser.snake, { type: "head-on", target: winner.snake });
            if (game.state !== "running") {
                return;
            }
        }
    }
}

function getSnakeMoveInterval(snake) {
    const baseMultiplier = getBaseSpeedMultiplier();
    const cappedBaseInterval = Math.max(MIN_MOVE_INTERVAL, BASE_MOVE_INTERVAL / baseMultiplier);
    return snake && snake.boostRemaining > 0 ? cappedBaseInterval / BOOST_MULTIPLIER : cappedBaseInterval;
}

function getBaseSpeedMultiplier() {
    const elapsedLevelUps = Math.floor(game.elapsedRunningTime / BASE_SPEED_STEP_INTERVAL);
    return Math.pow(BASE_SPEED_STEP_MULTIPLIER, elapsedLevelUps);
}

function getSnakeSpeedMultiplier(snake) {
    const cappedBaseInterval = Math.max(MIN_MOVE_INTERVAL, BASE_MOVE_INTERVAL / getBaseSpeedMultiplier());
    const actualInterval = snake ? getSnakeMoveInterval(snake) : cappedBaseInterval;
    return BASE_MOVE_INTERVAL / actualInterval;
}

function processSpawning() {
    if (game.items.length >= ITEM_LIMIT) {
        return;
    }

    if (game.spawnAccumulator < game.nextSpawnInterval) {
        return;
    }

    game.spawnAccumulator = 0;
    game.nextSpawnInterval = randomInt(MIN_SPAWN_INTERVAL, MAX_SPAWN_INTERVAL);

    const allowedCount = ITEM_LIMIT - game.items.length;
    const batchSize = Math.min(randomInt(MIN_SPAWN_BATCH, MAX_SPAWN_BATCH), allowedCount);
    seedItems(batchSize, null);
}

function ensureViewportItems() {
    if (game.items.length >= ITEM_LIMIT) {
        return;
    }

    const viewport = getViewport();
    const visibleCount = countItemsInViewport(viewport);
    if (visibleCount >= 2) {
        return;
    }

    const desiredAdditional = Math.min(3 - visibleCount, ITEM_LIMIT - game.items.length);
    if (desiredAdditional > 0) {
        seedItems(desiredAdditional, viewport);
    }
}

function countItemsInViewport(viewport) {
    return game.items.filter((item) => isInViewport(item, viewport)).length;
}

function seedItems(count, preferredRegion) {
    for (let index = 0; index < count; index += 1) {
        const position = findItemSpawnPosition(preferredRegion);
        if (!position) {
            return;
        }

        game.items.push({
            ...position,
            type: pickWeightedItemType(),
        });
    }
}

function findItemSpawnPosition(preferredRegion) {
    const preferred = preferredRegion ? findItemSpawnPositionInRegion(preferredRegion, 200) : null;
    if (preferred) {
        return preferred;
    }

    return findItemSpawnPositionInRegion({ left: 0, top: 0, right: BOARD_SIZE, bottom: BOARD_SIZE }, 600);
}

function findItemSpawnPositionInRegion(region, maxAttempts) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = {
            x: randomInt(region.left, region.right - 1),
            y: randomInt(region.top, region.bottom - 1),
        };

        if (isAnySnakeAt(candidate) || isItemAt(candidate) || isBulletAt(candidate) || isTooCloseToAnySnake(candidate)) {
            continue;
        }

        return candidate;
    }

    return null;
}

function pickWeightedItemType() {
    const randomValue = Math.random();
    let cursor = 0;

    for (const [type, config] of Object.entries(ITEM_TYPES)) {
        cursor += config.weight;
        if (randomValue <= cursor) {
            return type;
        }
    }

    return "grow";
}

function stepSnake(snake, plan = null) {
    if (!snake || !snake.segments.length) {
        return;
    }

    const currentDirection = snake.direction;
    const nextDirection = plan?.nextDirection ?? (snake.kind === "player" ? resolvePlayerDirection() : resolveNpcDirection(snake));
    const nextHead = plan?.nextHead ?? getNextPosition(snake.segments[0], nextDirection);
    const item = plan?.item ?? getItemAt(nextHead);
    const willGrow = plan?.willGrow ?? item?.type === "grow";
    const collision = detectSnakeCollision(snake, nextHead, willGrow, plan?.ignoredCollisionSnakeIds ?? []);

    if (collision) {
        handleSnakeDeath(snake, collision);
        return;
    }

    snake.previousSegments = cloneSegments(snake.segments);
    snake.direction = nextDirection;
    snake.straightSteps = nextDirection === currentDirection ? snake.straightSteps + 1 : 1;
    snake.segments.unshift(nextHead);

    if (item) {
        applyItemEffect(snake, item);
        game.items = game.items.filter((entry) => entry !== item);
    }

    if (!willGrow) {
        snake.segments.pop();
    }
}

function detectSnakeCollision(snake, nextHead, willGrow, ignoreSnakeIds = []) {
    if (isOutOfBounds(nextHead)) {
        return { type: "wall" };
    }

    const selfBody = willGrow ? snake.segments : snake.segments.slice(0, -1);
    if (selfBody.some((segment) => isSamePosition(segment, nextHead))) {
        return { type: "self" };
    }

    for (const otherSnake of getAllSnakes()) {
        if (otherSnake.id === snake.id) {
            continue;
        }

        if (ignoreSnakeIds.includes(otherSnake.id)) {
            continue;
        }

        if (otherSnake.segments.some((segment) => isSamePosition(segment, nextHead))) {
            return { type: otherSnake.kind === "player" ? "player" : "npc", target: otherSnake };
        }
    }

    return null;
}

function handleSnakeDeath(snake, collision) {
    if (snake.kind === "player") {
        const reasonMap = {
            wall: "蛇撞到了场地边界。",
            self: "蛇撞到了自己的身体。",
            npc: "蛇撞到了 NPC 蛇。",
            player: "蛇撞到了玩家蛇。",
            bullet: "蛇被子弹击中后死亡。",
            "head-on": "蛇在蛇头对撞中失败。",
        };
        endGame("Game Over", "玩家蛇已死亡", `最终得分：${game.score}。${reasonMap[collision.type] ?? ""}`);
        return;
    }

    if (collision.type === "player") {
        game.score += 2 + Math.ceil(snake.segments.length / 5);
    }

    removeNpcById(snake.id);
    ensureNpcCount();
}

function resolvePlayerDirection() {
    if (!game.player || !game.player.pendingAbsoluteDirection) {
        return game.player?.direction ?? "right";
    }

    const desired = game.player.pendingAbsoluteDirection;
    game.player.pendingAbsoluteDirection = null;
    return normalizeDirection(game.player.direction, desired);
}

function resolveNpcDirection(snake) {
    const tier = NPC_TIER_SETTINGS[snake.tier];
    const forwardDirection = snake.direction;
    const forwardCandidate = getNextPosition(snake.segments[0], forwardDirection);
    const forwardCollision = detectSnakeCollision(snake, forwardCandidate, getItemAt(forwardCandidate)?.type === "grow");

    if (
        snake.selfCrashEnabled
        && game.elapsedRunningTime >= 10000
        && Math.random() < 0.08
    ) {
        const selfCrashDirection = findSelfCrashDirection(snake);
        if (selfCrashDirection) {
            return selfCrashDirection;
        }
    }

    if (!forwardCollision && snake.straightSteps < 2) {
        return snake.direction;
    }

    const options = [snake.direction, LEFT_TURN[snake.direction], RIGHT_TURN[snake.direction]];
    let bestDirection = snake.direction;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const direction of options) {
        const candidate = getNextPosition(snake.segments[0], direction);
        const item = getItemAt(candidate);
        const collision = detectSnakeCollision(snake, candidate, item?.type === "grow");
        if (collision) {
            continue;
        }

        const score = scoreNpcDirection(snake, direction, candidate, item, tier);
        if (score > bestScore) {
            bestScore = score;
            bestDirection = direction;
        }
    }

    return bestDirection;
}

function scoreNpcDirection(snake, direction, candidate, item, tier) {
    let score = Math.random() * (snake.tier === "dumb" ? 0.9 : 0.3);
    const ignoreItems = tier.skipItemChance > 0 && Math.random() < tier.skipItemChance;

    if (direction === snake.direction) {
        score += 1.4;
    }

    if (!ignoreItems && item) {
        if (item.type === "grow") {
            score += 14;
        } else if (item.type === "boost") {
            score += 10;
        } else if (item.type === "bullet") {
            score += 11;
        }
    }

    const nearestItemDistance = getNearestItemDistance(candidate);
    if (!ignoreItems && nearestItemDistance !== null) {
        score += 7 / (nearestItemDistance + 1);
    }

    score += estimateFutureSafety(snake, candidate, direction, tier.lookaheadDepth) * 0.9;

    score += scoreNpcAggression(snake, candidate);

    return score;
}

function scoreNpcAggression(snake, candidate) {
    if (!game.player || game.elapsedRunningTime < NPC_ATTACK_START_TIME) {
        return 0;
    }

    if (snake.tier === "dumb") {
        return 0;
    }

    const distanceToPlayer = manhattanDistance(candidate, game.player.segments[0]);
    const aggroRange = snake.tier === "expert" ? EXPERT_AGGRO_RANGE : STANDARD_AGGRO_RANGE;
    if (distanceToPlayer > aggroRange) {
        return -Math.min(distanceToPlayer, 8) * 0.04;
    }

    let bestLaneDistance = Number.POSITIVE_INFINITY;
    let probe = { ...game.player.segments[0] };
    for (let step = 0; step < 4; step += 1) {
        probe = getNextPosition(probe, game.player.direction);
        bestLaneDistance = Math.min(bestLaneDistance, manhattanDistance(candidate, probe));
    }

    return 8 - bestLaneDistance * 1.2;
}

function estimateFutureSafety(snake, position, direction, depth) {
    if (depth <= 0) {
        return 0;
    }

    let best = 0;
    const options = [direction, LEFT_TURN[direction], RIGHT_TURN[direction]];

    for (const option of options) {
        const candidate = getNextPosition(position, option);
        const collision = detectSnakeCollision(snake, candidate, false);
        if (collision) {
            continue;
        }

        best = Math.max(best, 1 + estimateFutureSafety(snake, candidate, option, depth - 1));
    }

    return best;
}

function findSelfCrashDirection(snake) {
    const options = [snake.direction, LEFT_TURN[snake.direction], RIGHT_TURN[snake.direction]];
    for (const direction of options) {
        const candidate = getNextPosition(snake.segments[0], direction);
        const collision = detectSnakeCollision(snake, candidate, false);
        if (collision?.type === "self") {
            return direction;
        }
    }

    return null;
}

function getNearestItemDistance(position) {
    if (game.items.length === 0) {
        return null;
    }

    return game.items.reduce((best, item) => Math.min(best, manhattanDistance(position, item)), Number.POSITIVE_INFINITY);
}

function normalizeDirection(currentDirection, desiredDirection) {
    if (desiredDirection === currentDirection) {
        return currentDirection;
    }

    if (desiredDirection === OPPOSITE[currentDirection]) {
        return currentDirection;
    }

    if (desiredDirection === LEFT_TURN[currentDirection]) {
        return desiredDirection;
    }

    if (desiredDirection === RIGHT_TURN[currentDirection]) {
        return desiredDirection;
    }

    return currentDirection;
}

function applyItemEffect(snake, item) {
    if (snake.kind === "player") {
        game.score += ITEM_TYPES[item.type].score;
    }

    if (item.type === "boost") {
        snake.boostRemaining = BOOST_DURATION;
        return;
    }

    if (item.type === "bullet") {
        snake.bulletEffectRemaining = BULLET_EFFECT_DURATION;
        snake.bulletFireAccumulator = 0;
    }
}

function spawnBulletFromSnake(snake) {
    if (!snake || !snake.segments.length) {
        return;
    }

    const bulletVectors = BULLET_DIRECTION_VECTORS[snake.direction] ?? [];
    for (const vector of bulletVectors) {
        const start = getNextPosition(snake.segments[0], vector);
        if (isOutOfBounds(start)) {
            continue;
        }

        const hitSnake = getSnakeByPosition(start, snake.id);
        if (hitSnake) {
            applyBulletHit(hitSnake, snake);
            continue;
        }

        game.bullets.push({
            id: `bullet-${snake.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ownerId: snake.id,
            x: start.x,
            y: start.y,
            previousX: start.x,
            previousY: start.y,
            vector,
            moveAccumulator: 0,
            moveInterval: Math.max(20, getSnakeMoveInterval(snake) / 1.1),
        });
    }
}

function stepBullet(bullet) {
    if (!game.bullets.includes(bullet)) {
        return;
    }

    const nextPosition = getNextPosition(bullet, bullet.vector);
    if (isOutOfBounds(nextPosition)) {
        removeBulletById(bullet.id);
        return;
    }

    const targetSnake = getSnakeByPosition(nextPosition, bullet.ownerId);
    if (targetSnake) {
        applyBulletHit(targetSnake, null);
        removeBulletById(bullet.id);
        return;
    }

    bullet.previousX = bullet.x;
    bullet.previousY = bullet.y;
    bullet.x = nextPosition.x;
    bullet.y = nextPosition.y;
}

function applyBulletHit(targetSnake) {
    if (!targetSnake) {
        return;
    }

    if (targetSnake.segments.length < 3) {
        handleSnakeDeath(targetSnake, { type: "bullet" });
        return;
    }

    targetSnake.segments.pop();
}

function pauseGame() {
    if (game.state !== "running") {
        return;
    }

    game.state = "paused";
    cancelLoop();
    renderFrame();
    syncUi();
    showOverlay("Pause", "游戏已暂停", "点击“继续”恢复本局，或点击“退出”返回待开始状态。", true);
}

function resumeGame() {
    if (game.state !== "paused") {
        return;
    }

    game.state = "running";
    game.lastTimestamp = performance.now();
    hideOverlay();
    syncUi();
    startLoop();
}

function exitGame() {
    if (game.state !== "running" && game.state !== "paused") {
        return;
    }

    const shouldExit = window.confirm("确认退出当前对局吗？退出后本局进度不会保留。");
    if (!shouldExit) {
        return;
    }

    cancelLoop();
    game.state = "idle";
    game.player = null;
    game.npcs = [];
    game.items = [];
    game.bullets = [];
    game.score = 0;
    syncUi();
    renderFrame();
    showOverlay("Exit", "已退出当前对局", "点击“开始游戏”重新进入默认模式。", true);
}

function endGame(kicker, title, body) {
    cancelLoop();
    game.state = "over";
    syncUi();
    renderFrame();
    showOverlay(kicker, title, body, true);
}

function handleKeyDown(event) {
    const key = event.key.toLowerCase();

    if (key === " " || key === "spacebar") {
        event.preventDefault();
        if (game.state === "running") {
            pauseGame();
        } else if (game.state === "paused") {
            resumeGame();
        }
        return;
    }

    const direction = KEY_TO_DIRECTION[key];
    if (!direction || game.state !== "running" || !game.player) {
        return;
    }

    event.preventDefault();
    game.player.pendingAbsoluteDirection = direction;
}

function syncUi() {
    statusText.textContent = STATUS_LABELS[game.state];
    scoreText.textContent = String(game.score);
    speedText.textContent = `${getSnakeSpeedMultiplier(game.player).toFixed(2)}x`;
    boostText.textContent = `${((game.player?.boostRemaining ?? 0) / 1000).toFixed(1)}s`;

    startButton.disabled = game.state !== "idle";
    pauseButton.disabled = game.state !== "running";
    resumeButton.disabled = game.state !== "paused";
    restartButton.disabled = game.state !== "over";
    exitButton.disabled = game.state !== "running" && game.state !== "paused";
}

function renderFrame() {
    const viewport = getViewport();
    drawBoard(viewport);
    drawItems(viewport);
    drawBullets(viewport);
    drawSnakes(viewport);
}

function getViewport() {
    if (!game.player || game.player.segments.length === 0) {
        return {
            left: 0,
            top: 0,
            right: Math.min(VIEWPORT_CELLS, BOARD_SIZE),
            bottom: Math.min(VIEWPORT_CELLS, BOARD_SIZE),
        };
    }

    const head = getRenderedSnakeSegments(game.player)[0] ?? game.player.segments[0];
    const halfViewport = Math.floor(VIEWPORT_CELLS / 2);
    const maxLeft = Math.max(0, BOARD_SIZE - VIEWPORT_CELLS);
    const maxTop = Math.max(0, BOARD_SIZE - VIEWPORT_CELLS);
    const left = clamp(head.x - halfViewport, 0, maxLeft);
    const top = clamp(head.y - halfViewport, 0, maxTop);

    return {
        left,
        top,
        right: Math.min(left + VIEWPORT_CELLS, BOARD_SIZE),
        bottom: Math.min(top + VIEWPORT_CELLS, BOARD_SIZE),
    };
}

function drawBoard(viewport) {
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.fillStyle = "#f8f3e3";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    context.strokeStyle = "rgba(36, 55, 41, 0.08)";
    context.lineWidth = 1;

    const offsetX = -getViewportFraction(viewport.left) * CELL_SIZE;
    const offsetY = -getViewportFraction(viewport.top) * CELL_SIZE;

    for (let index = 0; index <= VIEWPORT_CELLS + 1; index += 1) {
        const x = offsetX + index * CELL_SIZE;
        const y = offsetY + index * CELL_SIZE;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, CANVAS_SIZE);
        context.stroke();

        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(CANVAS_SIZE, y);
        context.stroke();
    }

    drawBoardBoundaries(viewport);
}

function drawBoardBoundaries(viewport) {
    context.save();
    context.strokeStyle = "rgba(219, 111, 45, 0.95)";
    context.lineWidth = 4;

    if (viewport.left === 0) {
        const leftX = worldToScreen({ x: 0, y: 0 }, viewport).x;
        drawBoundaryLine(leftX, 0, leftX, CANVAS_SIZE);
    }

    if (viewport.right === BOARD_SIZE) {
        const rightX = worldToScreen({ x: BOARD_SIZE, y: 0 }, viewport).x;
        drawBoundaryLine(rightX, 0, rightX, CANVAS_SIZE);
    }

    if (viewport.top === 0) {
        const topY = worldToScreen({ x: 0, y: 0 }, viewport).y;
        drawBoundaryLine(0, topY, CANVAS_SIZE, topY);
    }

    if (viewport.bottom === BOARD_SIZE) {
        const bottomY = worldToScreen({ x: 0, y: BOARD_SIZE }, viewport).y;
        drawBoundaryLine(0, bottomY, CANVAS_SIZE, bottomY);
    }

    context.restore();
}

function drawBoundaryLine(startX, startY, endX, endY) {
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
}

function drawItems(viewport) {
    for (const item of game.items) {
        if (!isInViewport(item, viewport)) {
            continue;
        }

        const screenPosition = worldToScreen(item, viewport);
        const centerX = screenPosition.x + CELL_SIZE / 2;
        const centerY = screenPosition.y + CELL_SIZE / 2;
        const radius = CELL_SIZE * 0.35;

        context.beginPath();
        context.fillStyle = ITEM_TYPES[item.type].color;
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
    }
}

function drawBullets(viewport) {
    for (const bullet of game.bullets) {
        if (!isInViewport(bullet, viewport)) {
            continue;
        }

        const screenPosition = worldToScreen(getRenderedBulletPosition(bullet), viewport);
        const centerX = screenPosition.x + CELL_SIZE / 2;
        const centerY = screenPosition.y + CELL_SIZE / 2;
        drawStar(centerX, centerY, CELL_SIZE * 0.34, CELL_SIZE * 0.16, 5, "#111111");
    }
}

function drawStar(centerX, centerY, outerRadius, innerRadius, points, color) {
    context.beginPath();
    context.fillStyle = color;

    for (let index = 0; index < points * 2; index += 1) {
        const radius = index % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / points) * index - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }

    context.closePath();
    context.fill();
}

function drawSnakes(viewport) {
    for (const npc of game.npcs) {
        drawSnake(npc, viewport);
    }

    if (game.player) {
        drawSnake(game.player, viewport);
    }
}

function drawSnake(snake, viewport) {
    if (!snake || snake.segments.length === 0) {
        return;
    }

    const renderedSegments = getRenderedSnakeSegments(snake);

    for (let index = 1; index < renderedSegments.length; index += 1) {
        const segment = renderedSegments[index];
        if (!isInViewport(segment, viewport)) {
            continue;
        }

        const screenPosition = worldToScreen(segment, viewport);
        context.fillStyle = snake.colors.body;
        context.fillRect(screenPosition.x + 1, screenPosition.y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    drawHead(renderedSegments[0], snake.direction, viewport, snake.colors.head);
}

function drawHead(head, direction, viewport, color) {
    if (!isInViewport(head, viewport)) {
        return;
    }

    const screenPosition = worldToScreen(head, viewport);
    const left = screenPosition.x;
    const top = screenPosition.y;
    const right = left + CELL_SIZE;
    const bottom = top + CELL_SIZE;
    const centerX = left + CELL_SIZE / 2;
    const centerY = top + CELL_SIZE / 2;

    context.beginPath();
    context.fillStyle = color;

    if (direction === "up") {
        context.moveTo(centerX, top + 1);
        context.lineTo(right - 1, bottom - 1);
        context.lineTo(left + 1, bottom - 1);
    } else if (direction === "down") {
        context.moveTo(left + 1, top + 1);
        context.lineTo(right - 1, top + 1);
        context.lineTo(centerX, bottom - 1);
    } else if (direction === "left") {
        context.moveTo(left + 1, centerY);
        context.lineTo(right - 1, top + 1);
        context.lineTo(right - 1, bottom - 1);
    } else {
        context.moveTo(left + 1, top + 1);
        context.lineTo(right - 1, centerY);
        context.lineTo(left + 1, bottom - 1);
    }

    context.closePath();
    context.fill();
}

function showOverlay(kicker, title, body, visible) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    overlay.classList.toggle("visible", visible);
}

function hideOverlay() {
    overlay.classList.remove("visible");
}

function ensureNpcCount() {
    const counts = {
        dumb: 0,
        standard: 0,
        expert: 0,
    };

    for (const npc of game.npcs) {
        counts[npc.tier] += 1;
    }

    for (let index = 0; index < NPC_TIER_SEQUENCE.length; index += 1) {
        const tier = NPC_TIER_SEQUENCE[index];
        const targetCount = NPC_TIER_SEQUENCE.filter((entry) => entry === tier).length;

        if (counts[tier] >= targetCount) {
            continue;
        }

        const npc = createSnakeEntity("npc", index, tier);
        if (!npc) {
            continue;
        }

        game.npcs.push(npc);
        counts[tier] += 1;
    }
}

function removeNpcById(id) {
    game.npcs = game.npcs.filter((npc) => npc.id !== id);
}

function getAllSnakes() {
    return game.player ? [game.player, ...game.npcs] : [...game.npcs];
}

function getAllSnakeSegments() {
    return getAllSnakes().flatMap((snake) => snake.segments);
}

function getSnakeByPosition(position, ignoreSnakeId = null) {
    return getAllSnakes().find((snake) => snake.id !== ignoreSnakeId && snake.segments.some((segment) => isSamePosition(segment, position))) ?? null;
}

function isAnySnakeAt(position) {
    return getAllSnakeSegments().some((segment) => isSamePosition(segment, position));
}

function isTooCloseToAnySnake(position) {
    return getAllSnakeSegments().some((segment) => manhattanDistance(segment, position) < 2);
}

function getItemAt(position) {
    return game.items.find((item) => isSamePosition(item, position)) ?? null;
}

function isItemAt(position) {
    return game.items.some((item) => isSamePosition(item, position));
}

function isBulletAt(position) {
    return game.bullets.some((bullet) => isSamePosition(bullet, position));
}

function removeBulletById(id) {
    game.bullets = game.bullets.filter((bullet) => bullet.id !== id);
}

function getNextPosition(position, direction) {
    const vector = resolveMovementVector(direction);
    return {
        x: position.x + vector.x,
        y: position.y + vector.y,
    };
}

function isOutOfBounds(position) {
    return position.x < 0 || position.x >= BOARD_SIZE || position.y < 0 || position.y >= BOARD_SIZE;
}

function isSamePosition(first, second) {
    return first.x === second.x && first.y === second.y;
}

function manhattanDistance(first, second) {
    return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isInViewport(position, viewport) {
    return position.x >= viewport.left
        && position.x < viewport.right
        && position.y >= viewport.top
        && position.y < viewport.bottom;
}

function worldToScreen(position, viewport) {
    return {
        x: (position.x - viewport.left) * CELL_SIZE,
        y: (position.y - viewport.top) * CELL_SIZE,
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function resolveMovementVector(direction) {
    if (typeof direction === "string") {
        return DIRECTION_VECTORS[direction];
    }

    return direction;
}

function cloneSegments(segments) {
    return segments.map((segment) => ({ ...segment }));
}

function getRenderedSnakeSegments(snake) {
    if (!snake || snake.segments.length === 0) {
        return [];
    }

    const previousSegments = snake.previousSegments?.length ? snake.previousSegments : snake.segments;
    const fallbackPrevious = previousSegments[previousSegments.length - 1] ?? snake.segments[snake.segments.length - 1];
    const progress = clamp(snake.moveAccumulator / getSnakeMoveInterval(snake), 0, 1);

    return snake.segments.map((segment, index) => {
        const from = previousSegments[index] ?? fallbackPrevious;
        return interpolatePosition(from, segment, progress);
    });
}

function getRenderedBulletPosition(bullet) {
    const previousPosition = {
        x: bullet.previousX ?? bullet.x,
        y: bullet.previousY ?? bullet.y,
    };
    const currentPosition = { x: bullet.x, y: bullet.y };
    const progress = clamp(bullet.moveAccumulator / bullet.moveInterval, 0, 1);
    return interpolatePosition(previousPosition, currentPosition, progress);
}

function interpolatePosition(from, to, progress) {
    return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
    };
}

function getViewportFraction(value) {
    return value - Math.floor(value);
}