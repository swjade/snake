const BOARD_SIZE = 100;
const CANVAS_SIZE = 700;
const VIEWPORT_CELLS = 25;
const CELL_SIZE = CANVAS_SIZE / VIEWPORT_CELLS;
const BASE_MOVE_INTERVAL = 250;
const MIN_MOVE_INTERVAL = 100;
const BASE_SPEED_STEP_INTERVAL = 4000;
const BASE_SPEED_STEP_MULTIPLIER = 1.1;
const BOOST_MULTIPLIER = 1.3;
const BOOST_DURATION = 5000;
const BULLET_EFFECT_DURATION = 3000;
const BULLET_FIRE_INTERVAL = 600;
const VISUAL_EFFECT_DURATION = 500;
const MESSAGE_DURATION = 2200;
const MESSAGE_FADE_DURATION = 400;
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

const NPC_NAME_POOL = [
    "赤焰狐",
    "玄铁狼",
    "流云豹",
    "惊雷隼",
    "寒星鲨",
    "青岚鹫",
    "墨霜麟",
    "碎岩熊",
    "烈风鸦",
    "白虹狮",
    "霁月蟒",
    "飞霆雀",
    "暮山犀",
    "沧浪鹤",
    "金焰隼",
    "赤霄狼",
    "青电虎",
    "寒川豹",
    "墨影狐",
    "流光鹤",
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
const touchControls = document.getElementById("touchControls");
const joystickPad = document.getElementById("joystickPad");
const joystickKnob = document.getElementById("joystickKnob");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");
const exitButton = document.getElementById("exitButton");

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

const joystickState = {
    active: false,
    pointerId: null,
};

const game = {
    state: "idle",
    player: null,
    npcs: [],
    items: [],
    bullets: [],
    segmentLossEffects: [],
    deathEffects: [],
    combatMessages: [],
    pendingOverlay: null,
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
window.addEventListener("resize", syncTouchControls);

initTouchControls();
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
    game.segmentLossEffects = [];
    game.deathEffects = [];
    game.combatMessages = [];
    game.pendingOverlay = null;
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
        name: kind === "npc" ? createNpcName() : null,
        segments: spawnData.segments,
        previousSegments: cloneSegments(spawnData.segments),
        direction: spawnData.direction,
        pendingAbsoluteDirection: null,
        moveAccumulator: 0,
        boostRemaining: 0,
        bulletEffectRemaining: 0,
        bulletFireAccumulator: 0,
        straightSteps: 0,
        eliminated: false,
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

    updateVisualEffects(delta);

    renderFrame();
    syncUi();

    if (shouldContinueAnimating()) {
        game.animationFrameId = requestAnimationFrame(tick);
    } else {
        game.animationFrameId = null;
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
                handleSnakeDeath(current.snake, { type: "head-on", target: other.snake, position: current.nextHead, direction: current.nextDirection });
                if (game.state !== "running") {
                    return;
                }
                handleSnakeDeath(other.snake, { type: "head-on", target: current.snake, position: other.nextHead, direction: other.nextDirection });
                continue;
            }

            const winner = currentLength > otherLength ? current : other;
            const loser = winner === current ? other : current;
            loser.canceled = true;
            winner.ignoredCollisionSnakeIds.push(loser.snake.id);
            handleSnakeDeath(loser.snake, { type: "head-on", target: winner.snake, position: loser.nextHead, direction: loser.nextDirection });
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

    const viewport = getLogicalViewport();
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
    const left = Math.max(0, Math.ceil(region.left));
    const top = Math.max(0, Math.ceil(region.top));
    const right = Math.min(BOARD_SIZE, Math.floor(region.right));
    const bottom = Math.min(BOARD_SIZE, Math.floor(region.bottom));

    if (left >= right || top >= bottom) {
        return null;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = {
            x: randomInt(left, right - 1),
            y: randomInt(top, bottom - 1),
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
        handleSnakeDeath(snake, { ...collision, position: nextHead, direction: nextDirection });
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
        applyFatalCollisionPose(snake, collision);
        createDeathEffect(snake);
        snake.eliminated = true;
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

    createDeathEffect(snake);

    const deathMessage = getNpcDeathMessage(snake, collision);
    if (deathMessage) {
        pushCombatMessage(deathMessage, "npc");
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

function scoreNpcRivalry(snake, candidate, direction) {
    let score = 0;

    for (const otherNpc of game.npcs) {
        if (otherNpc.id === snake.id) {
            continue;
        }

        const currentDistance = manhattanDistance(snake.segments[0], otherNpc.segments[0]);
        const nextDistance = manhattanDistance(candidate, otherNpc.segments[0]);

        if (isParallelAdjacent(candidate, otherNpc.segments[0], direction, otherNpc.direction)) {
            score -= 7;
        }

        if (snake.tier !== "dumb" && nextDistance < currentDistance && nextDistance <= 3) {
            score += (4 - nextDistance) * 1.1;
        }
    }

    return score;
}

function isParallelAdjacent(firstPosition, secondPosition, firstDirection, secondDirection) {
    if (firstDirection !== secondDirection) {
        return false;
    }

    if (firstDirection === "up" || firstDirection === "down") {
        return Math.abs(firstPosition.x - secondPosition.x) === 1 && firstPosition.y === secondPosition.y;
    }

    return Math.abs(firstPosition.y - secondPosition.y) === 1 && firstPosition.x === secondPosition.x;
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
        spawnBulletFromSnake(snake);
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
        applyBulletHit(targetSnake, getSnakeById(bullet.ownerId));
        removeBulletById(bullet.id);
        return;
    }

    bullet.previousX = bullet.x;
    bullet.previousY = bullet.y;
    bullet.x = nextPosition.x;
    bullet.y = nextPosition.y;
}

function applyBulletHit(targetSnake, sourceSnake = null) {
    if (!targetSnake) {
        return;
    }

    if (targetSnake.segments.length <= 3) {
        handleSnakeDeath(targetSnake, { type: "bullet", source: sourceSnake });
        return;
    }

    const removedSegment = { ...targetSnake.segments[targetSnake.segments.length - 1] };
    targetSnake.segments.pop();
    createSegmentLossEffect(targetSnake, removedSegment);

    if (targetSnake.kind === "player") {
        pushCombatMessage(`玩家蛇由于子弹命中导致蛇身-1`, "player");
    }

    if (sourceSnake?.id === "player" && targetSnake.kind === "npc") {
        pushCombatMessage(`${targetSnake.name}蛇的蛇身被我的子弹击中-1`, "npc");
    }
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
    game.state = "over";
    hideOverlay();
    game.pendingOverlay = {
        kicker,
        title,
        body,
        remaining: VISUAL_EFFECT_DURATION,
    };
    syncUi();
    renderFrame();
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
    queuePlayerDirection(direction);
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
    const viewport = getRenderViewport();
    drawBoard(viewport);
    drawItems(viewport);
    drawBullets(viewport);
    drawSnakes(viewport);
    drawVisualEffects(viewport);
    drawCombatMessages();
}

function getLogicalViewport() {
    if (!game.player || game.player.segments.length === 0) {
        return {
            left: 0,
            top: 0,
            right: Math.min(VIEWPORT_CELLS, BOARD_SIZE),
            bottom: Math.min(VIEWPORT_CELLS, BOARD_SIZE),
        };
    }

    const head = game.player.segments[0];
    return buildViewportAround(head);
}

function getRenderViewport() {
    if (!game.player || game.player.segments.length === 0) {
        return getLogicalViewport();
    }

    if (game.state !== "running") {
        return getLogicalViewport();
    }

    const head = getRenderedSnakeSegments(game.player)[0] ?? game.player.segments[0];
    return buildViewportAround(head);
}

function buildViewportAround(head) {
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
    if (!snake || snake.segments.length === 0 || snake.eliminated) {
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
    drawSnakeName(snake, renderedSegments, viewport);
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
    const targetCounts = {
        dumb: 3,
        standard: 3,
        expert: 2,
    };

    game.npcs = game.npcs.filter((npc) => npc && Object.hasOwn(targetCounts, npc.tier));

    const counts = {
        dumb: 0,
        standard: 0,
        expert: 0,
    };

    for (const npc of game.npcs) {
        npc.colors = NPC_TIER_SETTINGS[npc.tier].colors;
        counts[npc.tier] += 1;
    }

    for (let index = 0; index < NPC_TIER_SEQUENCE.length; index += 1) {
        const tier = NPC_TIER_SEQUENCE[index];
        const targetCount = targetCounts[tier];

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

    game.npcs.sort((first, second) => NPC_TIER_SEQUENCE.indexOf(first.tier) - NPC_TIER_SEQUENCE.indexOf(second.tier));
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

function getSnakeById(id) {
    return getAllSnakes().find((snake) => snake.id === id) ?? null;
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

function initTouchControls() {
    syncTouchControls();

    if (!joystickPad) {
        return;
    }

    joystickPad.addEventListener("pointerdown", handleJoystickPointerDown);
    joystickPad.addEventListener("pointermove", handleJoystickPointerMove);
    joystickPad.addEventListener("pointerup", handleJoystickPointerUp);
    joystickPad.addEventListener("pointercancel", handleJoystickPointerUp);
    joystickPad.addEventListener("pointerleave", handleJoystickPointerUp);
}

function syncTouchControls() {
    if (!touchControls) {
        return;
    }

    touchControls.classList.toggle("visible", isTouchDevice);
    touchControls.setAttribute("aria-hidden", String(!isTouchDevice));
}

function handleJoystickPointerDown(event) {
    if (!isTouchDevice || !joystickPad) {
        return;
    }

    joystickState.active = true;
    joystickState.pointerId = event.pointerId;
    joystickPad.setPointerCapture(event.pointerId);
    updateJoystickFromPointer(event);
}

function handleJoystickPointerMove(event) {
    if (!joystickState.active || joystickState.pointerId !== event.pointerId) {
        return;
    }

    updateJoystickFromPointer(event);
}

function handleJoystickPointerUp(event) {
    if (!joystickState.active || joystickState.pointerId !== event.pointerId) {
        return;
    }

    joystickState.active = false;
    joystickState.pointerId = null;
    resetJoystickKnob();
}

function updateJoystickFromPointer(event) {
    const bounds = joystickPad.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxDistance = bounds.width * 0.28;
    let deltaX = event.clientX - centerX;
    let deltaY = event.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > maxDistance && distance > 0) {
        const ratio = maxDistance / distance;
        deltaX *= ratio;
        deltaY *= ratio;
    }

    joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    if (distance < bounds.width * 0.16) {
        return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        queuePlayerDirection(deltaX > 0 ? "right" : "left");
        return;
    }

    queuePlayerDirection(deltaY > 0 ? "down" : "up");
}

function resetJoystickKnob() {
    if (joystickKnob) {
        joystickKnob.style.transform = "translate(0, 0)";
    }
}

function queuePlayerDirection(direction) {
    if (!direction || game.state !== "running" || !game.player) {
        return;
    }

    game.player.pendingAbsoluteDirection = direction;
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

    if (game.state !== "running") {
        return snake.segments;
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

function applyFatalCollisionPose(snake, collision) {
    if (!snake || !collision?.position || isOutOfBounds(collision.position)) {
        return;
    }

    snake.previousSegments = cloneSegments(snake.segments);

    if (collision.direction) {
        snake.direction = collision.direction;
    }

    snake.segments = [collision.position, ...snake.segments.slice(0, -1)];
}

function updateVisualEffects(delta) {
    game.segmentLossEffects = game.segmentLossEffects
        .map((effect) => ({ ...effect, remaining: effect.remaining - delta }))
        .filter((effect) => effect.remaining > 0);

    game.deathEffects = game.deathEffects
        .map((effect) => ({ ...effect, remaining: effect.remaining - delta }))
        .filter((effect) => effect.remaining > 0);

    game.combatMessages = game.combatMessages
        .map((message) => ({ ...message, remaining: message.remaining - delta }))
        .filter((message) => message.remaining > 0);

    if (game.pendingOverlay) {
        game.pendingOverlay.remaining -= delta;
        if (game.pendingOverlay.remaining <= 0) {
            showOverlay(game.pendingOverlay.kicker, game.pendingOverlay.title, game.pendingOverlay.body, true);
            game.pendingOverlay = null;
        }
    }
}

function shouldContinueAnimating() {
    return game.state === "running"
        || game.segmentLossEffects.length > 0
        || game.deathEffects.length > 0
        || game.combatMessages.length > 0
        || Boolean(game.pendingOverlay);
}

function createSegmentLossEffect(snake, position) {
    game.segmentLossEffects.push({
        position,
        color: snake.colors.body,
        remaining: VISUAL_EFFECT_DURATION,
        duration: VISUAL_EFFECT_DURATION,
    });
}

function createDeathEffect(snake) {
    game.deathEffects.push({
        segments: cloneSegments(snake.segments),
        direction: snake.direction,
        colors: { ...snake.colors },
        remaining: VISUAL_EFFECT_DURATION,
        duration: VISUAL_EFFECT_DURATION,
    });
}

function getNpcDeathMessage(snake, collision) {
    if (!snake?.name) {
        return null;
    }

    if (collision.type === "player") {
        return `${snake.name}蛇由于撞到玩家蛇身死亡`;
    }

    if (collision.type === "head-on" && collision.target?.kind === "player") {
        return `${snake.name}蛇由于与玩家蛇头对撞失败死亡`;
    }

    if (collision.type === "bullet" && collision.source?.id === "player") {
        return `${snake.name}蛇由于被我的子弹击中死亡`;
    }

    return null;
}

function pushCombatMessage(text, tone) {
    const toneColor = tone === "player" ? "#274d37" : "#8b2f2f";
    game.combatMessages.unshift({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        toneColor,
        remaining: MESSAGE_DURATION,
        duration: MESSAGE_DURATION,
    });
    game.combatMessages = game.combatMessages.slice(0, 4);
}

function drawVisualEffects(viewport) {
    for (const effect of game.segmentLossEffects) {
        drawSegmentLossEffect(effect, viewport);
    }

    for (const effect of game.deathEffects) {
        drawDeathEffect(effect, viewport);
    }
}

function drawSegmentLossEffect(effect, viewport) {
    if (!isInViewport(effect.position, viewport)) {
        return;
    }

    const progress = 1 - effect.remaining / effect.duration;
    const scale = 1 - progress * 0.75;
    const alpha = 1 - progress;
    drawScaledCell(effect.position, viewport, effect.color, scale, alpha);
}

function drawDeathEffect(effect, viewport) {
    const progress = 1 - effect.remaining / effect.duration;
    const scale = 1 - progress * 0.7;
    const alpha = 1 - progress;

    for (let index = 0; index < effect.segments.length; index += 1) {
        const segment = effect.segments[index];
        if (!isInViewport(segment, viewport)) {
            continue;
        }

        if (index === 0) {
            drawScaledHead(segment, effect.direction, viewport, effect.colors.head, scale, alpha);
            continue;
        }

        drawScaledCell(segment, viewport, effect.colors.body, scale, alpha);
    }
}

function drawScaledCell(position, viewport, color, scale, alpha) {
    const screenPosition = worldToScreen(position, viewport);
    const size = (CELL_SIZE - 2) * scale;
    const inset = (CELL_SIZE - size) / 2;

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(screenPosition.x + inset, screenPosition.y + inset, size, size);
    context.restore();
}

function drawScaledHead(head, direction, viewport, color, scale, alpha) {
    const screenPosition = worldToScreen(head, viewport);
    const left = screenPosition.x + (CELL_SIZE * (1 - scale)) / 2;
    const top = screenPosition.y + (CELL_SIZE * (1 - scale)) / 2;
    const size = CELL_SIZE * scale;
    const right = left + size;
    const bottom = top + size;
    const centerX = left + size / 2;
    const centerY = top + size / 2;

    context.save();
    context.globalAlpha = alpha;
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
    context.restore();
}

function drawCombatMessages() {
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = 'bold 16px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

    for (let index = 0; index < game.combatMessages.length; index += 1) {
        const message = game.combatMessages[index];
        const fadeStart = Math.max(0, message.duration - MESSAGE_FADE_DURATION);
        const alpha = message.remaining > fadeStart ? 1 : clamp(message.remaining / MESSAGE_FADE_DURATION, 0, 1);
        const y = 26 + index * 30;
        const width = Math.min(CANVAS_SIZE - 40, context.measureText(message.text).width + 28);

        context.globalAlpha = alpha;
        context.fillStyle = "rgba(255, 251, 239, 0.88)";
        context.fillRect((CANVAS_SIZE - width) / 2, y - 12, width, 24);
        context.fillStyle = message.toneColor;
        context.fillText(message.text, CANVAS_SIZE / 2, y);
    }

    context.restore();
}

function drawSnakeName(snake, renderedSegments, viewport) {
    if (snake.kind !== "npc" || !snake.name) {
        return;
    }

    const characters = [...snake.name].slice(0, 3);

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = 'bold 14px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    context.fillStyle = "rgba(255, 248, 239, 0.95)";
    context.strokeStyle = "rgba(36, 55, 41, 0.65)";
    context.lineWidth = 2;

    for (let index = 0; index < characters.length && index < renderedSegments.length; index += 1) {
        const segment = renderedSegments[index];
        if (!isInViewport(segment, viewport)) {
            continue;
        }

        const screenPosition = worldToScreen(segment, viewport);
        const x = screenPosition.x + CELL_SIZE / 2;
        const y = screenPosition.y + CELL_SIZE / 2;
        context.strokeText(characters[index], x, y);
        context.fillText(characters[index], x, y);
    }

    context.restore();
}

function createNpcName() {
    const usedNames = new Set(game.npcs.map((npc) => npc.name).filter(Boolean));
    const availableNames = NPC_NAME_POOL.filter((name) => !usedNames.has(name));
    const source = availableNames.length > 0 ? availableNames : NPC_NAME_POOL;
    return source[randomInt(0, source.length - 1)];
}