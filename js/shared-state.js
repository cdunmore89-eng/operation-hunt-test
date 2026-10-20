"use strict";

const STORAGE_KEY = "operation-hunt-state";
const CHANNEL_NAME = "operation-hunt-channel";
const SHARED_PLAYER_LIMIT = 6;
const DEFAULT_GRID_SIZE = 2;
const DEFAULT_REQUIRED_ADDENDS = 2;

const GAME_MODES = Object.freeze({
    CLASSIC: "CLASSIC",
    MAX_OUT: "MAX_OUT",
    PRACTICE: "PRACTICE"
});

const OPERATION_IDS = Object.freeze([
    "addition",
    "subtraction",
    "multiplication",
    "division"
]);

const DEFAULT_OPERATION = "addition";
const MINIMUM_FLOOR_WITH_NEGATIVES = -20;
const MINIMUM_FLOOR_WITHOUT_NEGATIVES = 1;

const CONTENT_IDS = Object.freeze(["arithmetic", "algebra"]);
const GRADE_BAND_IDS = Object.freeze(["k-2", "3-5", "6-8"]);
const ALGEBRA_SKILL_IDS = Object.freeze([
    "missing-number",
    "evaluate",
    "solve",
    "equivalent",
    "mixed"
]);
const ACTUAL_ALGEBRA_SKILL_IDS = Object.freeze([
    "missing-number",
    "evaluate",
    "solve",
    "equivalent"
]);
const SOLVE_STEP_IDS = Object.freeze(["one-step", "two-step", "mixed"]);
const ALGEBRA_SKILLS_BY_BAND = Object.freeze({
    "k-2": Object.freeze(["missing-number"]),
    "3-5": Object.freeze(["missing-number", "evaluate", "solve"]),
    "6-8": Object.freeze(["missing-number", "evaluate", "solve", "equivalent"])
});
const DEFAULT_CONTENT = "arithmetic";
const DEFAULT_GRADE_BAND = "k-2";
const DEFAULT_ALGEBRA_SKILL = "missing-number";
const DEFAULT_SOLVE_STEPS = "mixed";

function normalizeContent(value) {
    return CONTENT_IDS.includes(value) ? value : DEFAULT_CONTENT;
}

function normalizeGradeBand(value) {
    return GRADE_BAND_IDS.includes(value) ? value : DEFAULT_GRADE_BAND;
}

function getAlgebraSkillsForBand(gradeBand) {
    return [...(ALGEBRA_SKILLS_BY_BAND[normalizeGradeBand(gradeBand)] || [])];
}

function normalizeAlgebraSkill(value, gradeBand = DEFAULT_GRADE_BAND) {
    if (value === "mixed") {
        return "mixed";
    }

    return getAlgebraSkillsForBand(gradeBand).includes(value)
        ? value
        : DEFAULT_ALGEBRA_SKILL;
}

function normalizeSolveSteps(value) {
    return SOLVE_STEP_IDS.includes(value) ? value : DEFAULT_SOLVE_STEPS;
}

function normalizeOperation(value) {
    return OPERATION_IDS.includes(value)
        ? value
        : DEFAULT_OPERATION;
}

const ROUND_STATUSES = Object.freeze({
    NOT_STARTED: "NOT_STARTED",
    READY: "READY",
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    COMPLETE: "COMPLETE"
});

function createDefaultPlayers() {
    return Array.from({ length: SHARED_PLAYER_LIMIT }, (_, index) => ({
        name: `Player ${index + 1}`,
        score: 0,
        attempts: 0,
        correct: 0,
        currentStreak: 0,
        bestStreak: 0,
        roundStatus: ROUND_STATUSES.NOT_STARTED
    }));
}

function createDefaultState() {
    const boardSize = DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE;

    return {
        gameMode: GAME_MODES.CLASSIC,

        puzzle: [],
        gridSize: DEFAULT_GRID_SIZE,
        boardSize,

        selectedIndexes: [],
        struckIndexes: [],
        matchedTargetIndex: null,

        validTriples: [],
        validCombinations: [],
        completedTriples: [],
        algebraRound: null,

        correctAddends: [],
        sum: null,
        equation: "",
        status: "WAITING",

        playerCount: 2,
        activePlayerIndex: 0,
        players: createDefaultPlayers(),

        totalPuzzles: 0,
        totalAttempts: 0,
        totalCorrect: 0,

        settings: {
            gridSize: DEFAULT_GRID_SIZE,
            requiredAddends: DEFAULT_REQUIRED_ADDENDS,
            minimumNumber: 1,
            maximumNumber: 20,
            showRunningSum: false,
            operation: DEFAULT_OPERATION,
            allowNegatives: false,
            content: DEFAULT_CONTENT,
            gradeBand: DEFAULT_GRADE_BAND,
            algebraSkill: DEFAULT_ALGEBRA_SKILL,
            solveSteps: DEFAULT_SOLVE_STEPS
        },

        timer: {
            enabled: false,
            duration: 30,
            remaining: 30,
            running: false,
            endTime: null
        },

        maxOut: {
            roundStatus: ROUND_STATUSES.NOT_STARTED,
            currentRoundScore: 0,
            currentRoundAttempts: 0,
            currentRoundCorrect: 0,
            currentStreak: 0,
            bestStreak: 0,
            puzzlesPresented: 0,
            feedback: null,
            equationValues: {
                first: null,
                second: null,
                result: null
            },
            currentTriple: null,
            remainingTripleCount: 0,
            puzzleComplete: false
        },

        practice: {
            puzzlesAttempted: 0,
            strikes: 0,
            misses: 0,
            currentStreak: 0,
            bestStreak: 0
        },

        display: {
            showLeaderboard: true,
            showEquation: true,
            showHudDetails: true,
            soundEnabled: true
        }
    };
}

function normalizeNumber(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizePlayer(player, index) {
    return {
        name: typeof player?.name === "string" ? player.name : `Player ${index + 1}`,
        score: normalizeNumber(player?.score, 0),
        attempts: normalizeNumber(player?.attempts, 0),
        correct: normalizeNumber(player?.correct, 0),
        currentStreak: normalizeNumber(player?.currentStreak, 0),
        bestStreak: normalizeNumber(player?.bestStreak, 0),
        roundStatus: Object.values(ROUND_STATUSES).includes(player?.roundStatus)
            ? player.roundStatus
            : ROUND_STATUSES.NOT_STARTED
    };
}

function normalizePlayers(players) {
    const normalized = Array.isArray(players)
        ? players.slice(0, SHARED_PLAYER_LIMIT).map(normalizePlayer)
        : [];

    while (normalized.length < SHARED_PLAYER_LIMIT) {
        normalized.push(normalizePlayer(null, normalized.length));
    }

    return normalized;
}

function normalizeIndexArray(indexes, boardLength) {
    if (!Array.isArray(indexes)) {
        return [];
    }

    return [...new Set(indexes.filter(index => (
        Number.isInteger(index) &&
        index >= 0 &&
        index < boardLength
    )))];
}

function normalizeCombination(combo, boardLength) {
    if (!combo || typeof combo !== "object") {
        return null;
    }

    const addendIndexes = Array.isArray(combo.addendIndexes)
        ? combo.addendIndexes.map(Number).filter(Number.isInteger)
        : [Number(combo.firstIndex), Number(combo.secondIndex)].filter(Number.isInteger);

    const resultIndex = Number(combo.resultIndex);
    const allIndexes = [...addendIndexes, resultIndex];

    const valid = allIndexes.every(index => (
        Number.isInteger(index) &&
        index >= 0 &&
        index < boardLength
    ));

    if (!valid || new Set(allIndexes).size !== allIndexes.length) {
        return null;
    }

    const addendValues = Array.isArray(combo.addendValues)
        ? combo.addendValues.map(Number)
        : [];

    const record = {
        addendIndexes,
        resultIndex,
        addendValues,
        resultValue: normalizeNumber(combo.resultValue, null),
        indexes: allIndexes,
        equation: typeof combo.equation === "string" ? combo.equation : ""
    };

    // Preserve the multi-operation fields when present, so a combo
    // generated on the teacher screen keeps its operand order and
    // operation identity when it reaches the smart board.
    if (Array.isArray(combo.operandIndexes)) {
        record.operandIndexes = combo.operandIndexes
            .map(Number)
            .filter(Number.isInteger);
    }

    if (Array.isArray(combo.operandValues)) {
        record.operandValues = combo.operandValues.map(Number);
    }

    if (typeof combo.operation === "string") {
        record.operation = normalizeOperation(combo.operation);
    }

    if (typeof combo.symbol === "string") {
        record.symbol = combo.symbol;
    }

    if (addendIndexes.length >= 2) {
        record.firstIndex = addendIndexes[0];
        record.secondIndex = addendIndexes[1];
        record.firstValue = addendValues[0] ?? null;
        record.secondValue = addendValues[1] ?? null;
    }

    return record;
}

function normalizeCombinations(combinations, boardLength) {
    if (!Array.isArray(combinations)) {
        return [];
    }

    return combinations
        .map(combo => normalizeCombination(combo, boardLength))
        .filter(Boolean);
}

function normalizeGridSize(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 2 && parsed <= 5
        ? parsed
        : DEFAULT_GRID_SIZE;
}

function normalizeRequiredAddends(value, gridSize) {
    const allowed = gridSize <= 2 ? [2] : gridSize === 3 ? [2, 3] : [2, 3, 4];
    const parsed = Number(value);

    return Number.isInteger(parsed) && allowed.includes(parsed)
        ? parsed
        : allowed[allowed.length - 1];
}

function sanitizeAlgebraValue(value, depth = 0) {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return typeof value === "string" ? value.slice(0, 1000) : value;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (depth >= 5) {
        return null;
    }

    if (Array.isArray(value)) {
        return value
            .slice(0, 100)
            .map(item => sanitizeAlgebraValue(item, depth + 1))
            .filter(item => item !== undefined);
    }

    if (value && typeof value === "object") {
        const sanitized = {};

        Object.entries(value).slice(0, 100).forEach(([key, item]) => {
            const clean = sanitizeAlgebraValue(item, depth + 1);
            if (clean !== undefined) {
                sanitized[String(key).slice(0, 80)] = clean;
            }
        });

        return sanitized;
    }

    return undefined;
}

function normalizeAlgebraTile(tile, skill) {
    if (!tile || typeof tile !== "object") {
        return null;
    }

    const face = typeof tile.face === "string" ? tile.face.trim() : "";
    const kind = ["number", "expression", "candidate"].includes(tile.kind)
        ? tile.kind
        : null;

    if (!face || face.length > 80 || !kind) {
        return null;
    }

    const rawValue = tile.value;
    const value = rawValue === null || rawValue === undefined
        ? null
        : Number(rawValue);

    if (skill !== "equivalent" && !Number.isFinite(value)) {
        return null;
    }

    if (value !== null && !Number.isFinite(value)) {
        return null;
    }

    const canonical = tile.canonical &&
        Number.isFinite(Number(tile.canonical.a)) &&
        Number.isFinite(Number(tile.canonical.b))
        ? {
            a: Number(tile.canonical.a),
            b: Number(tile.canonical.b)
        }
        : null;

    return {
        face,
        value,
        kind,
        canonical,
        templateId: typeof tile.templateId === "string" ? tile.templateId.slice(0, 100) : null,
        errorPatternId: typeof tile.errorPatternId === "string" ? tile.errorPatternId.slice(0, 100) : null,
        missFeedback: typeof tile.missFeedback === "string" ? tile.missFeedback.slice(0, 1000) : null,
        faceTier: Number.isInteger(tile.faceTier) && tile.faceTier >= 0 && tile.faceTier <= 4
            ? tile.faceTier
            : Math.min(4, Math.max(0, Math.floor(face.length / 4)))
    };
}

function normalizeAlgebraRound(round, gradeBand = DEFAULT_GRADE_BAND) {
    if (!round || typeof round !== "object" || round.content !== "algebra") {
        return null;
    }

    const band = normalizeGradeBand(round.gradeBand ?? gradeBand);
    const skill = round.skill;

    if (!ACTUAL_ALGEBRA_SKILL_IDS.includes(skill) || !getAlgebraSkillsForBand(band).includes(skill)) {
        return null;
    }

    const gridSize = normalizeGridSize(round.gridSize);
    const boardSize = gridSize * gridSize;

    if (!Array.isArray(round.tiles) || round.tiles.length !== boardSize) {
        return null;
    }

    const tiles = round.tiles.map(tile => normalizeAlgebraTile(tile, skill));

    if (tiles.some(tile => !tile) || new Set(tiles.map(tile => tile.face)).size !== tiles.length) {
        return null;
    }

    const solution = sanitizeAlgebraValue(round.solution);
    const solutionIndexes = Array.isArray(solution?.indexes)
        ? solution.indexes.map(Number).filter(Number.isInteger)
        : [];

    if (
        solutionIndexes.length === 0 ||
        new Set(solutionIndexes).size !== solutionIndexes.length ||
        solutionIndexes.some(index => index < 0 || index >= boardSize)
    ) {
        return null;
    }

    const banner = sanitizeAlgebraValue(round.banner);

    if (!banner || typeof banner.text !== "string" || !banner.text) {
        return null;
    }

    return {
        content: "algebra",
        skill,
        requestedSkill: normalizeAlgebraSkill(round.requestedSkill, band),
        gradeBand: band,
        solveSteps: normalizeSolveSteps(round.solveSteps),
        operation: normalizeOperation(round.operation),
        allowNegatives: Boolean(round.allowNegatives),
        gridSize,
        boardSize,
        variable: sanitizeAlgebraValue(round.variable),
        banner,
        question: sanitizeAlgebraValue(round.question),
        tiles,
        solution,
        feedback: sanitizeAlgebraValue(round.feedback) || {},
        templateId: typeof round.templateId === "string" ? round.templateId.slice(0, 100) : null,
        metadata: sanitizeAlgebraValue(round.metadata) || {}
    };
}

function normalizeState(savedState = {}) {
    const defaults = createDefaultState();
    const gridSize = normalizeGridSize(savedState.settings?.gridSize ?? savedState.gridSize ?? defaults.gridSize);
    const requiredAddends = normalizeRequiredAddends(savedState.settings?.requiredAddends, gridSize);
    const boardSize = gridSize * gridSize;

    const puzzle = Array.isArray(savedState.puzzle)
        ? savedState.puzzle.filter(value => Number.isFinite(Number(value))).map(Number)
        : [];

    const boardLength = puzzle.length;

    const validCombinations = normalizeCombinations(
        savedState.validCombinations || savedState.validTriples,
        boardLength
    );

    const normalizedMaxOut = {
        ...defaults.maxOut,
        ...(savedState.maxOut || {}),
        equationValues: {
            ...defaults.maxOut.equationValues,
            ...(savedState.maxOut?.equationValues || {})
        },
        currentTriple: normalizeCombination(savedState.maxOut?.currentTriple, boardLength)
    };

    return {
        ...defaults,
        ...savedState,

        gameMode: normalizeContent(savedState.settings?.content) === "algebra"
            ? GAME_MODES.CLASSIC
            : Object.values(GAME_MODES).includes(savedState.gameMode)
                ? savedState.gameMode
                : GAME_MODES.CLASSIC,

        puzzle,
        gridSize,
        boardSize,

        selectedIndexes: normalizeIndexArray(savedState.selectedIndexes, boardLength),
        struckIndexes: normalizeIndexArray(savedState.struckIndexes, boardLength),
        matchedTargetIndex: Number.isInteger(savedState.matchedTargetIndex) &&
            savedState.matchedTargetIndex >= 0 &&
            savedState.matchedTargetIndex < boardLength
            ? savedState.matchedTargetIndex
            : null,

        validTriples: normalizeCombinations(savedState.validTriples, boardLength),
        validCombinations,
        completedTriples: normalizeCombinations(savedState.completedTriples, boardLength),

        players: normalizePlayers(savedState.players),
        playerCount: Math.min(Math.max(normalizeInteger(savedState.playerCount, defaults.playerCount), 1), SHARED_PLAYER_LIMIT),
        activePlayerIndex: Math.min(Math.max(normalizeInteger(savedState.activePlayerIndex, defaults.activePlayerIndex), 0), SHARED_PLAYER_LIMIT - 1),

        settings: {
            ...defaults.settings,
            ...(savedState.settings || {}),
            gridSize,
            requiredAddends,
            operation: normalizeOperation(savedState.settings?.operation),
            allowNegatives: Boolean(savedState.settings?.allowNegatives),
            content: normalizeContent(savedState.settings?.content),
            gradeBand: normalizeGradeBand(savedState.settings?.gradeBand),
            algebraSkill: normalizeAlgebraSkill(
                savedState.settings?.algebraSkill,
                normalizeGradeBand(savedState.settings?.gradeBand)
            ),
            solveSteps: normalizeSolveSteps(savedState.settings?.solveSteps),
            minimumNumber: Math.max(
                Boolean(savedState.settings?.allowNegatives)
                    ? MINIMUM_FLOOR_WITH_NEGATIVES
                    : MINIMUM_FLOOR_WITHOUT_NEGATIVES,
                normalizeInteger(savedState.settings?.minimumNumber, defaults.settings.minimumNumber)
            ),
            maximumNumber: Math.max(2, normalizeInteger(savedState.settings?.maximumNumber, defaults.settings.maximumNumber)),
            showRunningSum: Boolean(savedState.settings?.showRunningSum)
        },

        algebraRound: normalizeAlgebraRound(
            savedState.algebraRound,
            normalizeGradeBand(savedState.settings?.gradeBand)
        ),

        timer: {
            ...defaults.timer,
            ...(savedState.timer || {})
        },

        maxOut: normalizedMaxOut,

        practice: {
            ...defaults.practice,
            ...(savedState.practice || {})
        },

        display: {
            ...defaults.display,
            ...(savedState.display || {})
        }
    };
}

function loadState() {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return createDefaultState();
    }

    try {
        return normalizeState(JSON.parse(saved));
    } catch (error) {
        console.error("Could not load saved Operation Hunt state:", error);
        return createDefaultState();
    }
}

const sharedState = loadState();
const gameChannel = "BroadcastChannel" in window
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

function dispatchStateChange(reason = "state-updated") {
    window.dispatchEvent(new CustomEvent("operationhuntstatechange", {
        detail: {
            reason,
            state: sharedState
        }
    }));
}

function saveState(options = {}) {
    const { broadcast = true, reason = "state-updated" } = options;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState));

    if (broadcast && gameChannel) {
        gameChannel.postMessage({
            type: "STATE_UPDATED",
            reason,
            state: sharedState
        });
    }

    dispatchStateChange(reason);
}

function replaceState(nextState, reason = "state-replaced") {
    const normalizedState = normalizeState(nextState);

    Object.keys(sharedState).forEach(key => {
        delete sharedState[key];
    });

    Object.assign(sharedState, normalizedState);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState));
    dispatchStateChange(reason);
}

function resetSharedState() {
    replaceState(createDefaultState(), "state-reset");

    if (gameChannel) {
        gameChannel.postMessage({
            type: "STATE_UPDATED",
            reason: "state-reset",
            state: sharedState
        });
    }
}

function resetPuzzleState() {
    sharedState.puzzle = [];
    sharedState.gridSize = sharedState.settings.gridSize;
    sharedState.boardSize = sharedState.gridSize * sharedState.gridSize;
    sharedState.selectedIndexes = [];
    sharedState.struckIndexes = [];
    sharedState.matchedTargetIndex = null;
    sharedState.validTriples = [];
    sharedState.validCombinations = [];
    sharedState.completedTriples = [];
    sharedState.algebraRound = null;
    sharedState.correctAddends = [];
    sharedState.sum = null;
    sharedState.equation = "";
    sharedState.status = "WAITING";
}

function resetTimerState() {
    sharedState.timer.running = false;
    sharedState.timer.endTime = null;
    sharedState.timer.remaining = sharedState.timer.duration;
}

function resetMaxOutState() {
    sharedState.maxOut = {
        ...createDefaultState().maxOut,
        equationValues: {
            ...createDefaultState().maxOut.equationValues
        }
    };
}

function setGameMode(gameMode) {
    if (
        sharedState.settings.content === "algebra" &&
        gameMode !== GAME_MODES.CLASSIC
    ) {
        return false;
    }

    if (!Object.values(GAME_MODES).includes(gameMode)) {
        console.error(`Invalid Operation Hunt mode: ${gameMode}`);
        return false;
    }

    sharedState.gameMode = gameMode;
    resetPuzzleState();
    resetTimerState();
    resetMaxOutState();

    saveState({ reason: "game-mode-changed" });
    return true;
}

function setOperation(operation) {
    sharedState.settings.operation = normalizeOperation(operation);
    resetPuzzleState();
    resetTimerState();
    resetMaxOutState();

    saveState({ reason: "operation-changed" });
    return sharedState.settings.operation;
}

function setAllowNegatives(allowNegatives) {
    sharedState.settings.allowNegatives = Boolean(allowNegatives);

    const minimumFloor = sharedState.settings.allowNegatives
        ? MINIMUM_FLOOR_WITH_NEGATIVES
        : MINIMUM_FLOOR_WITHOUT_NEGATIVES;

    if (sharedState.settings.minimumNumber < minimumFloor) {
        sharedState.settings.minimumNumber = minimumFloor;
    }

    resetPuzzleState();
    resetTimerState();
    resetMaxOutState();

    saveState({ reason: "allow-negatives-changed" });
    return sharedState.settings.allowNegatives;
}

/*
Seamless variants of the two setters above: they update the
setting (and, for negatives, re-clamp the minimum to the new
floor) and save + broadcast, but they do NOT reset the
puzzle, timer or Max Out state. The teacher controller uses
these for mid-session changes and then decides itself —
via the engine's evaluateBoardForSettings — whether the
current board stays in play or a fresh puzzle is dealt in
place, saving again so both screens end on the final state.
*/
function setOperationInPlace(operation) {
    sharedState.settings.operation = normalizeOperation(operation);

    saveState({ reason: "operation-changed" });
    return sharedState.settings.operation;
}

function setAllowNegativesInPlace(allowNegatives) {
    sharedState.settings.allowNegatives = Boolean(allowNegatives);

    const minimumFloor = sharedState.settings.allowNegatives
        ? MINIMUM_FLOOR_WITH_NEGATIVES
        : MINIMUM_FLOOR_WITHOUT_NEGATIVES;

    if (sharedState.settings.minimumNumber < minimumFloor) {
        sharedState.settings.minimumNumber = minimumFloor;
    }

    saveState({ reason: "allow-negatives-changed" });
    return sharedState.settings.allowNegatives;
}

function setContentInPlace(content) {
    sharedState.settings.content = normalizeContent(content);

    if (sharedState.settings.content === "algebra") {
        sharedState.gameMode = GAME_MODES.CLASSIC;
    }

    saveState({ reason: "content-changed" });
    return sharedState.settings.content;
}

function setGradeBandInPlace(gradeBand) {
    sharedState.settings.gradeBand = normalizeGradeBand(gradeBand);
    sharedState.settings.algebraSkill = normalizeAlgebraSkill(
        sharedState.settings.algebraSkill,
        sharedState.settings.gradeBand
    );

    saveState({ reason: "grade-band-changed" });
    return sharedState.settings.gradeBand;
}

function setAlgebraSkillInPlace(algebraSkill) {
    sharedState.settings.algebraSkill = normalizeAlgebraSkill(
        algebraSkill,
        sharedState.settings.gradeBand
    );

    saveState({ reason: "algebra-skill-changed" });
    return sharedState.settings.algebraSkill;
}

function setSolveStepsInPlace(solveSteps) {
    sharedState.settings.solveSteps = normalizeSolveSteps(solveSteps);

    saveState({ reason: "solve-steps-changed" });
    return sharedState.settings.solveSteps;
}

function getSharedState() {
    return sharedState;
}

function subscribeToState(callback) {
    if (typeof callback !== "function") {
        throw new TypeError("Operation Hunt state subscriber must be a function.");
    }

    const listener = event => {
        callback(event.detail.state, event.detail.reason);
    };

    window.addEventListener("operationhuntstatechange", listener);

    return () => {
        window.removeEventListener("operationhuntstatechange", listener);
    };
}

if (gameChannel) {
    gameChannel.addEventListener("message", event => {
        const message = event.data;

        if (!message || message.type !== "STATE_UPDATED" || !message.state) {
            return;
        }

        replaceState(message.state, message.reason || "broadcast-update");
    });
}

window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
    }

    try {
        replaceState(JSON.parse(event.newValue), "storage-update");
    } catch (error) {
        console.error("Could not process Operation Hunt storage update:", error);
    }
});

window.OperationHuntState = Object.freeze({
    MAX_PLAYERS: SHARED_PLAYER_LIMIT,
    DEFAULT_GRID_SIZE,
    DEFAULT_BOARD_SIZE: DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE,
    DEFAULT_REQUIRED_ADDENDS,
    GAME_MODES,
    ROUND_STATUSES,
    OPERATIONS: OPERATION_IDS,
    DEFAULT_OPERATION,
    CONTENT_IDS,
    GRADE_BAND_IDS,
    ALGEBRA_SKILL_IDS,
    ACTUAL_ALGEBRA_SKILL_IDS,
    SOLVE_STEP_IDS,
    DEFAULT_CONTENT,
    DEFAULT_GRADE_BAND,
    DEFAULT_ALGEBRA_SKILL,
    DEFAULT_SOLVE_STEPS,
    normalizeContent,
    normalizeGradeBand,
    normalizeAlgebraSkill,
    normalizeSolveSteps,
    getAlgebraSkillsForBand,
    normalizeAlgebraRound,
    MINIMUM_FLOOR_WITH_NEGATIVES,
    MINIMUM_FLOOR_WITHOUT_NEGATIVES,
    normalizeOperation,
    getState: getSharedState,
    saveState,
    replaceState,
    resetState: resetSharedState,
    setGameMode,
    setOperation,
    setAllowNegatives,
    setOperationInPlace,
    setAllowNegativesInPlace,
    setContentInPlace,
    setGradeBandInPlace,
    setAlgebraSkillInPlace,
    setSolveStepsInPlace,
    subscribe: subscribeToState
});
