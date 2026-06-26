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
            showRunningSum: false
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

        gameMode: Object.values(GAME_MODES).includes(savedState.gameMode)
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
            minimumNumber: Math.max(1, normalizeInteger(savedState.settings?.minimumNumber, defaults.settings.minimumNumber)),
            maximumNumber: Math.max(2, normalizeInteger(savedState.settings?.maximumNumber, defaults.settings.maximumNumber)),
            showRunningSum: Boolean(savedState.settings?.showRunningSum)
        },

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
    getState: getSharedState,
    saveState,
    replaceState,
    resetState: resetSharedState,
    setGameMode,
    subscribe: subscribeToState
});
