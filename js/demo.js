"use strict";

/*
====================================================
DEPENDENCIES
====================================================
*/

const puzzleEngine =
    window.OperationHuntPuzzleEngine;

if (!puzzleEngine) {
    throw new Error(
        "OperationHuntPuzzleEngine did not load."
    );
}

/*
====================================================
CONSTANTS
====================================================
*/

const GAME_MODES = Object.freeze({
    CLASSIC: "CLASSIC",
    MAX_OUT: "MAX_OUT",
    PRACTICE: "PRACTICE"
});

const PLAYER_LIMIT = 6;
const DEFAULT_GRID_SIZE = 2;
const DEFAULT_BOARD_SIZE =
    DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE;
const DEFAULT_REQUIRED_ADDENDS = 2;

const STRIKE_FEEDBACK_DELAY = 900;
const MISS_FEEDBACK_DELAY = 650;

/*
====================================================
STATE
====================================================
*/

const state = {
    gameMode: GAME_MODES.CLASSIC,

    puzzle: [],
    gridSize: DEFAULT_GRID_SIZE,
    boardSize: DEFAULT_BOARD_SIZE,

    selectedIndexes: [],
    struckIndexes: [],
    matchedTargetIndex: null,

    validTriples: [],
    validCombinations: [],
    completedTriples: [],

    equation: "",
    status: "WAITING",

    playerCount: 2,
    activePlayerIndex: 0,

    players: createPlayers(),

    totalPuzzles: 0,
    totalAttempts: 0,
    totalCorrect: 0,

    settings: {
        gridSize: DEFAULT_GRID_SIZE,
        requiredAddends: DEFAULT_REQUIRED_ADDENDS,
        minimumNumber: 1,
        maximumNumber: 20,
        operation: "addition",
        allowNegatives: false,
        showRunningSum: false
    },

    timer: {
        enabled: false,
        duration: 30,
        remaining: 30,
        running: false,
        endTime: null
    }
};

let feedbackTimeoutId = null;
let timerIntervalId = null;
let boardSwapTimeoutId = null;

/*
====================================================
ELEMENTS
====================================================
*/

const elements = {
    gameMode:
        document.querySelector(
            "#game-mode"
        ),

    operation:
        document.querySelector(
            "#operation"
        ),

    allowNegativesToggle:
        document.querySelector(
            "#allow-negatives-toggle"
        ),

    gameModeDescription:
        document.querySelector(
            "#game-mode-description"
        ),

    footerModeLabel:
        document.querySelector(
            ".demo-footer-mode-label"
        ),

    gameInstructions:
        document.querySelector(
            "#game-instructions"
        ),

    sessionStatus:
        document.querySelector(
            "#session-status"
        ),

    statusCard:
        document.querySelector(
            ".status-card"
        ),

    newPuzzleButton:
        document.querySelector(
            "#new-puzzle-button"
        ),

    revealButton:
        document.querySelector(
            "#reveal-button"
        ),

    previousPlayerButton:
        document.querySelector(
            "#previous-player-button"
        ),

    nextPlayerButton:
        document.querySelector(
            "#next-player-button"
        ),

    resetScoresButton:
        document.querySelector(
            "#reset-scores-button"
        ),

    resetBoardButton:
        document.querySelector(
            "#reset-board-button"
        ),

    playerCount:
        document.querySelector(
            "#player-count"
        ),

    gridSize:
        document.querySelector(
            "#grid-size"
        ),

    requiredAddends:
        document.querySelector(
            "#required-addends"
        ),

    minimumNumber:
        document.querySelector(
            "#minimum-number"
        ),

    maximumNumber:
        document.querySelector(
            "#maximum-number"
        ),

    activePlayerLabel:
        document.querySelector(
            "#active-player-label"
        ),

    activePlayerName:
        document.querySelector(
            "#active-player-name"
        ),

    scoreboard:
        document.querySelector(
            "#scoreboard"
        ),

    puzzleBoard:
        document.querySelector(
            "#puzzle-board"
        ),

    puzzleCells: [],

    equationDisplay:
        document.querySelector(
            "#equation-display"
        ),

    runningSumToggle:
        document.querySelector(
            "#running-sum-toggle"
        ),

    totalPuzzles:
        document.querySelector(
            "#total-puzzles"
        ),

    totalAttempts:
        document.querySelector(
            "#total-attempts"
        ),

    totalCorrect:
        document.querySelector(
            "#total-correct"
        ),

    classAccuracy:
        document.querySelector(
            "#class-accuracy"
        ),

    timerCard:
        document.querySelector(
            "#timer-card"
        ),

    timerToggle:
        document.querySelector(
            "#timer-toggle"
        ),

    timerToggleLabel:
        document.querySelector(
            "#timer-toggle-label"
        ),

    timerDuration:
        document.querySelector(
            "#timer-duration"
        ),

    timerRing:
        document.querySelector(
            "#timer-ring"
        ),

    timerDisplay:
        document.querySelector(
            "#timer-display"
        ),

    timerCaption:
        document.querySelector(
            "#timer-caption"
        )
};

/*
====================================================
STATE HELPERS
====================================================
*/

function createPlayers() {
    return Array.from(
        {
            length: PLAYER_LIMIT
        },
        (_, index) => ({
            name: `Player ${index + 1}`,
            score: 0,
            attempts: 0,
            correct: 0,
            currentStreak: 0,
            bestStreak: 0
        })
    );
}

function isMaxOutMode() {
    return (
        state.gameMode ===
        GAME_MODES.MAX_OUT
    );
}

function isPracticeMode() {
    return (
        state.gameMode ===
        GAME_MODES.PRACTICE
    );
}

function isFlowMode() {
    return (
        isMaxOutMode() ||
        isPracticeMode()
    );
}

function puzzleExists() {
    return (
        Array.isArray(state.puzzle) &&
        state.puzzle.length > 0
    );
}

function getActivePlayer() {
    return (
        state.players[
        state.activePlayerIndex
        ] || state.players[0]
    );
}

function isIndexStruck(index) {
    return state.struckIndexes.includes(
        index
    );
}

function isBoardInteractive() {
    return (
        state.status === "OPEN" &&
        puzzleExists()
    );
}

function clearFeedbackTimeout() {
    if (feedbackTimeoutId === null) {
        return;
    }

    window.clearTimeout(
        feedbackTimeoutId
    );

    feedbackTimeoutId = null;
}

function clearSelection() {
    state.selectedIndexes = [];
    state.matchedTargetIndex = null;
}

function resetPuzzleState() {
    state.puzzle = [];
    state.gridSize =
        state.settings.gridSize;
    state.boardSize =
        state.gridSize * state.gridSize;

    state.selectedIndexes = [];
    state.struckIndexes = [];
    state.matchedTargetIndex = null;

    state.validTriples = [];
    state.validCombinations = [];
    state.completedTriples = [];

    state.equation = "";
    state.status = "WAITING";
}

function addUniqueIndexes(
    originalIndexes,
    indexesToAdd
) {
    return [
        ...new Set([
            ...originalIndexes,
            ...indexesToAdd
        ])
    ];
}

function advancePlayer(direction = 1) {
    const count =
        Math.max(
            1,
            state.playerCount
        );

    state.activePlayerIndex =
        (
            state.activePlayerIndex +
            direction +
            count
        ) % count;
}

/*
====================================================
OPERATION HELPERS
====================================================
*/

function getOperation() {
    if (
        puzzleEngine &&
        typeof puzzleEngine.normalizeOperation ===
            "function"
    ) {
        return puzzleEngine.normalizeOperation(
            state.settings.operation
        );
    }

    return state.settings.operation || "addition";
}

function getOperationMeta() {
    if (
        puzzleEngine &&
        typeof puzzleEngine.getOperation ===
            "function"
    ) {
        return puzzleEngine.getOperation(
            getOperation()
        );
    }

    return {
        id: "addition",
        label: "Addition",
        symbol: "+"
    };
}

function getOperationSymbol() {
    return getOperationMeta().symbol;
}

function getOperationLabel() {
    return getOperationMeta().label;
}

/*
Verb phrase used in the instruction text, so the
sentence reads e.g. "Find 2 numbers that add to
another number..." / "...that divide to make
another number...".
*/
function getOperationVerbPhrase() {
    switch (getOperation()) {
        case "subtraction":
            return "subtract to make";
        case "multiplication":
            return "multiply to make";
        case "division":
            return "divide to make";
        default:
            return "add to";
    }
}

function findComboForCurrentOperation(
    numbers,
    selectedIndexes,
    requiredAddends,
    excludedIndexes
) {
    if (
        puzzleEngine &&
        typeof puzzleEngine.findComboForOperation ===
            "function"
    ) {
        return puzzleEngine.findComboForOperation(
            numbers,
            selectedIndexes,
            requiredAddends,
            excludedIndexes,
            getOperation()
        );
    }

    return puzzleEngine.findComboForSelection(
        numbers,
        selectedIndexes,
        requiredAddends,
        excludedIndexes
    );
}

/*
====================================================
MODE CONTROL
====================================================
*/

/*
Seamless settings changes (Operation / Allow Negatives):
changing either setting never wipes the board and never
asks for confirmation. The decision is the engine's
evaluateBoardForSettings: if the exact same tiles are
still legal under the new settings AND at least one valid
combination exists on them for the (possibly new)
operation, the board stays in play — only the current
selection/feedback is cleared and the solution set is
recomputed. Otherwise a fresh puzzle is dealt in place
immediately, without advancing the turn and without
touching the timer, so the board never sits blank in a
WAITING state mid-session. Scores, names and the active
player are untouched either way.
*/
function evaluateCurrentBoard() {
    if (
        puzzleEngine &&
        typeof puzzleEngine.evaluateBoardForSettings ===
            "function"
    ) {
        return puzzleEngine.evaluateBoardForSettings(
            state.puzzle,
            {
                operation: getOperation(),
                allowNegatives:
                    state.settings.allowNegatives,
                requiredAddends:
                    state.settings.requiredAddends
            }
        );
    }

    // Fallback for an older engine build: same decision
    // assembled from the primitives.
    const combinations =
        puzzleEngine.findCombinations(
            state.puzzle,
            state.settings.requiredAddends,
            [],
            getOperation()
        );

    const tilesLegal =
        state.puzzle.every(
            value =>
                Number.isInteger(value) &&
                value >= getMinimumFloor()
        );

    return {
        playable:
            tilesLegal &&
            combinations.length > 0,
        combinations
    };
}

function keepCurrentBoard(combinations) {
    clearSelection();

    state.struckIndexes = [];
    state.completedTriples = [];

    state.validCombinations = [
        ...combinations
    ];

    // Mirror createNumberPuzzle: "triples" are the
    // 2-term combinations when more terms are in play.
    state.validTriples =
        state.settings.requiredAddends === 2
            ? [...combinations]
            : puzzleEngine.findCombinations(
                state.puzzle,
                2,
                [],
                getOperation()
            );

    state.equation =
        combinations.length > 0
            ? combinations[0].equation
            : "";

    state.status = "OPEN";
}

function applySettingsChangeToBoard() {
    if (!puzzleExists()) {
        return;
    }

    clearFeedbackTimeout();

    if (state.status === "TIME_UP") {
        // The round already ended, so there is no live
        // board to preserve; clear back to WAITING the
        // same way Reset Board does.
        resetPuzzleState();
        resetTimerToDuration();
        return;
    }

    const evaluation =
        evaluateCurrentBoard();

    if (evaluation.playable) {
        keepCurrentBoard(
            evaluation.combinations
        );

        return;
    }

    // Not playable under the new settings: deal a fresh
    // puzzle in place. generatePuzzle never advances the
    // turn, and preserveTimer leaves a running timer
    // exactly as it was. The swap is instant and in place
    // (no reload, no WAITING frame); flagBoardSwap only
    // adds a brief fade so the new tiles land smoothly.
    const previousPuzzle =
        state.puzzle.join(",");

    generatePuzzle({
        preserveTimer: true
    });

    if (
        puzzleExists() &&
        state.puzzle.join(",") !== previousPuzzle
    ) {
        flagBoardSwap();
    }
}

function flagBoardSwap() {
    elements.puzzleBoard.classList.add(
        "board-swap"
    );

    if (boardSwapTimeoutId !== null) {
        window.clearTimeout(boardSwapTimeoutId);
    }

    boardSwapTimeoutId =
        window.setTimeout(() => {
            boardSwapTimeoutId = null;

            elements.puzzleBoard.classList.remove(
                "board-swap"
            );
        }, 400);
}

function updateOperation() {
    if (!elements.operation) {
        return;
    }

    const selectedOperation =
        getOperationMetaForValue(
            elements.operation.value
        );

    if (
        selectedOperation ===
        getOperation()
    ) {
        elements.operation.value =
            getOperation();

        return;
    }

    state.settings.operation =
        selectedOperation;

    // The maximum may need to rise for the new
    // operation (e.g. multiplication / division).
    enforceNumberRangeForGrid();

    applySettingsChangeToBoard();

    render();
}

function getMinimumFloor() {
    return state.settings.allowNegatives
        ? -20
        : 1;
}

function updateAllowNegatives() {
    if (!elements.allowNegativesToggle) {
        return;
    }

    const selectedValue =
        Boolean(
            elements.allowNegativesToggle.checked
        );

    if (
        selectedValue ===
        state.settings.allowNegatives
    ) {
        return;
    }

    state.settings.allowNegatives =
        selectedValue;

    // Re-clamps the minimum to the new floor (1 when
    // negatives are off, -20 when they are on) and
    // raises the maximum if the operation needs it.
    enforceNumberRangeForGrid();

    applySettingsChangeToBoard();

    render();
}

function getOperationMetaForValue(value) {
    if (
        puzzleEngine &&
        typeof puzzleEngine.normalizeOperation ===
            "function"
    ) {
        return puzzleEngine.normalizeOperation(value);
    }

    return value || "addition";
}

function updateGameMode() {
    const selectedMode =
        elements.gameMode.value;

    if (
        selectedMode ===
        state.gameMode
    ) {
        return;
    }

    const confirmed =
        !puzzleExists() ||
        window.confirm(
            "Changing game modes will clear the current puzzle. Continue?"
        );

    if (!confirmed) {
        elements.gameMode.value =
            state.gameMode;

        return;
    }

    clearFeedbackTimeout();
    stopTimer();
    resetPuzzleState();

    state.gameMode =
        selectedMode;

    state.timer.remaining =
        state.timer.duration;

    render();
}

function renderGameMode() {
    const maxOut =
        isMaxOutMode();

    const practice =
        isPracticeMode();

    elements.gameMode.value =
        state.gameMode;

    elements.gameModeDescription
        .textContent =
        practice
            ? "Endless no-timer practice with session stats."
            : maxOut
                ? "Clear as many puzzles as possible before time expires."
                : "Complete one target equation per puzzle.";

    elements.gameInstructions
        .textContent =
        practice
            ? `Practice finding ${state.settings.requiredAddends} numbers that ${getOperationVerbPhrase()} a target. Keep going until the session is reset.`
            : maxOut
                ? `Find ${state.settings.requiredAddends} numbers that ${getOperationVerbPhrase()} a target. Solve as many as possible before time expires.`
                : `Find ${state.settings.requiredAddends} numbers that ${getOperationVerbPhrase()} another number on the radar and strike the target.`;

    if (elements.footerModeLabel) {
        elements.footerModeLabel
            .textContent =
            (
                practice
                    ? "Practice Training Active"
                    : maxOut
                        ? "Max Out Training Active"
                        : "Classic Hunt Training Active"
            ) + ` · ${getOperationLabel()}`;
    }

    document.body.classList.toggle(
        "mode-classic",
        !maxOut && !practice
    );

    document.body.classList.toggle(
        "mode-max-out",
        maxOut
    );

    document.body.classList.toggle(
        "mode-practice",
        practice
    );

    if (practice) {
        state.timer.enabled = false;
        stopTimer();
        resetTimerToDuration();
    }

    document.title =
        practice
            ? "Operation Hunt: Practice — Demo"
            : maxOut
                ? "Operation Hunt: Max Out — Demo"
                : "Operation Hunt: Classic Hunt — Demo";
}

/*
====================================================
PUZZLE GENERATION
====================================================
*/

function readGridSizeSetting() {
    const gridSize =
        Number.parseInt(
            elements.gridSize.value,
            10
        );

    if (![2, 3, 4, 5].includes(gridSize)) {
        return DEFAULT_GRID_SIZE;
    }

    return gridSize;
}

function getAllowedRequiredAddends(gridSize) {
    if (
        puzzleEngine &&
        typeof puzzleEngine.getAllowedRequiredAddends ===
            "function"
    ) {
        return puzzleEngine
            .getAllowedRequiredAddends(gridSize);
    }

    if (gridSize <= 2) {
        return [2];
    }

    if (gridSize === 3) {
        return [2, 3];
    }

    return [2, 3, 4];
}

function readRequiredAddendsSetting(gridSize) {
    const allowedRequiredAddends =
        getAllowedRequiredAddends(gridSize);

    const requestedRequiredAddends =
        Number.parseInt(
            elements.requiredAddends.value,
            10
        );

    if (
        allowedRequiredAddends.includes(
            requestedRequiredAddends
        )
    ) {
        return requestedRequiredAddends;
    }

    return allowedRequiredAddends[
        allowedRequiredAddends.length - 1
    ];
}

function syncRequiredAddendsOptions(gridSize) {
    const allowedRequiredAddends =
        getAllowedRequiredAddends(gridSize);

    elements.requiredAddends
        .querySelectorAll("option")
        .forEach(option => {
            const value = Number.parseInt(
                option.value,
                10
            );

            option.disabled =
                !allowedRequiredAddends.includes(
                    value
                );
        });

    const currentRequiredAddends =
        Number.parseInt(
            elements.requiredAddends.value,
            10
        );

    if (
        !allowedRequiredAddends.includes(
            currentRequiredAddends
        )
    ) {
        elements.requiredAddends.value =
            String(
                allowedRequiredAddends[
                    allowedRequiredAddends.length - 1
                ]
            );
    }
}

function getRequiredMaximumForSettings(
    minimum,
    gridSize,
    requiredAddends,
    operation = getOperation()
) {
    const boardSize = gridSize * gridSize;

    if (
        puzzleEngine &&
        typeof puzzleEngine.getMinimumMaximumForOperation ===
            "function"
    ) {
        return puzzleEngine
            .getMinimumMaximumForOperation(
                minimum,
                boardSize,
                requiredAddends,
                operation
            );
    }

    if (
        puzzleEngine &&
        typeof puzzleEngine.getMinimumMaximumForPuzzle ===
            "function"
    ) {
        return puzzleEngine
            .getMinimumMaximumForPuzzle(
                minimum,
                boardSize,
                requiredAddends
            );
    }

    return minimum + boardSize - 1;
}

function enforceNumberRangeForGrid() {
    const gridSize = readGridSizeSetting();

    syncRequiredAddendsOptions(gridSize);

    const requiredAddends =
        readRequiredAddendsSetting(gridSize);

    let minimum =
        Number.parseInt(
            elements.minimumNumber.value,
            10
        );

    const minimumFloor = getMinimumFloor();

    if (
        !Number.isInteger(minimum) ||
        minimum < minimumFloor
    ) {
        minimum = minimumFloor;
    }

    elements.minimumNumber.min =
        String(minimumFloor);

    const requiredMaximum =
        getRequiredMaximumForSettings(
            minimum,
            gridSize,
            requiredAddends
        );

    let maximum =
        Number.parseInt(
            elements.maximumNumber.value,
            10
        );

    if (
        !Number.isInteger(maximum) ||
        maximum < requiredMaximum
    ) {
        maximum = requiredMaximum;
    }

    elements.minimumNumber.value =
        String(minimum);

    elements.maximumNumber.min =
        String(requiredMaximum);

    elements.maximumNumber.value =
        String(maximum);

    elements.requiredAddends.value =
        String(requiredAddends);

    state.settings.gridSize = gridSize;
    state.settings.requiredAddends =
        requiredAddends;
    state.settings.minimumNumber = minimum;
    state.settings.maximumNumber = maximum;

    return {
        gridSize,
        requiredAddends,
        minimum,
        maximum,
        boardSize: gridSize * gridSize
    };
}

function readNumberSettings() {
    const settings =
        enforceNumberRangeForGrid();

    if (
        !Number.isInteger(settings.minimum) ||
        !Number.isInteger(settings.maximum) ||
        settings.minimum < getMinimumFloor() ||
        settings.maximum <= settings.minimum
    ) {
        throw new Error(
            "Minimum and maximum must be whole numbers, and maximum must be greater than minimum."
        );
    }

    if (
        settings.maximum - settings.minimum + 1 <
        settings.boardSize
    ) {
        throw new Error(
            `A ${settings.gridSize}×${settings.gridSize} grid needs at least ${settings.boardSize} unique numbers.`
        );
    }

    const requiredMaximum =
        getRequiredMaximumForSettings(
            settings.minimum,
            settings.gridSize,
            settings.requiredAddends
        );

    if (settings.maximum < requiredMaximum) {
        throw new Error(
            `${settings.requiredAddends} terms starting at ${settings.minimum} need the maximum to be at least ${requiredMaximum}.`
        );
    }

    return settings;
}

function generatePuzzle(options = {}) {
    const {
        preserveTimer = false
    } = options;

    let settings;

    try {
        settings =
            readNumberSettings();
    } catch (error) {
        window.alert(error.message);
        return;
    }

    if (!preserveTimer) {
        stopTimer();
    }

    try {
        const generated =
            puzzleEngine
                .createNumberPuzzle({
                    minimum: settings.minimum,
                    maximum: settings.maximum,
                    gridSize: settings.gridSize,
                    requiredAddends: settings.requiredAddends,
                    operation: getOperation(),
                    allowNegatives:
                        state.settings.allowNegatives
                });

        const primaryTriple =
            (generated.combinations || generated.triples)[0];

        state.settings.gridSize =
            settings.gridSize;

        state.settings.requiredAddends =
            settings.requiredAddends;

        state.settings.minimumNumber =
            settings.minimum;

        state.settings.maximumNumber =
            settings.maximum;

        state.puzzle = [
            ...generated.numbers
        ];

        state.gridSize =
            generated.gridSize;

        state.boardSize =
            generated.boardSize;

        state.selectedIndexes = [];
        state.struckIndexes = [];
        state.matchedTargetIndex = null;
        state.completedTriples = [];

        state.validTriples = [
            ...(generated.triples || [])
        ];

        state.validCombinations = [
            ...(generated.combinations || generated.triples || [])
        ];

        state.equation =
            primaryTriple
                ? primaryTriple.equation
                : "";

        state.status = "OPEN";

        state.totalPuzzles += 1;

        if (!preserveTimer) {
            if (
                state.timer.enabled &&
                !isPracticeMode()
            ) {
                startTimer();
            } else {
                resetTimerToDuration();
            }
        }

        render();
    } catch (error) {
        console.error(
            "Puzzle generation failed:",
            error
        );

        window.alert(error.message);
    }
}

function generateNextFlowPuzzle() {
    if (isPracticeMode()) {
        generatePuzzle({
            preserveTimer: true
        });

        return;
    }

    if (
        !state.timer.enabled ||
        getLiveTimerRemaining() <= 0
    ) {
        finishMaxOutRound();
        return;
    }

    generatePuzzle({
        preserveTimer: true
    });
}

/*
====================================================
PUZZLE INTERACTION
====================================================
*/

function handlePuzzleClick(event) {
    const index =
        Number.parseInt(
            event.currentTarget
                .dataset.index,
            10
        );

    if (
        !Number.isInteger(index) ||
        !isBoardInteractive()
    ) {
        return;
    }

    if (
        isFlowMode() &&
        isIndexStruck(index)
    ) {
        return;
    }

    if (
        state.selectedIndexes.includes(
            index
        )
    ) {
        state.selectedIndexes =
            state.selectedIndexes.filter(
                selectedIndex =>
                    selectedIndex !==
                    index
            );

        render();
        return;
    }

    if (
        state.selectedIndexes.length >=
        state.settings.requiredAddends
    ) {
        return;
    }

    state.selectedIndexes.push(index);

    if (
        state.selectedIndexes.length ===
        state.settings.requiredAddends
    ) {
        checkAnswer();
    }

    render();
}

function checkAnswer() {
    const player =
        getActivePlayer();

    player.attempts += 1;
    state.totalAttempts += 1;

    cacheAttemptEquation();

    if (isFlowMode()) {
        checkFlowAnswer(player);
    } else {
        checkClassicAnswer(player);
    }
}

/*
====================================================
CLASSIC HUNT
====================================================
*/

function checkClassicAnswer(player) {
    const triple =
        findComboForCurrentOperation(
            state.puzzle,
            state.selectedIndexes,
            state.settings.requiredAddends,
            []
        );

    if (!triple) {
        handleMiss(player);
        return;
    }

    awardCorrect(player);

    state.matchedTargetIndex =
        triple.resultIndex;

    state.completedTriples = [
        {
            ...triple
        }
    ];

    state.equation =
        triple.equation;

    state.status = "SOLVED";

    stopTimer();
    render();

    clearFeedbackTimeout();

    feedbackTimeoutId =
        window.setTimeout(() => {
            feedbackTimeoutId = null;

            state.status =
                "COMPLETE";

            render();
        }, STRIKE_FEEDBACK_DELAY);
}

/*
====================================================
MAX OUT
====================================================
*/

function checkFlowAnswer(player) {
    const triple =
        findComboForCurrentOperation(
            state.puzzle,
            state.selectedIndexes,
            state.settings.requiredAddends,
            []
        );

    if (!triple) {
        handleMiss(player);
        return;
    }

    awardCorrect(player);

    state.matchedTargetIndex =
        triple.resultIndex;

    state.completedTriples = [
        {
            ...triple
        }
    ];

    state.struckIndexes = [];

    state.equation =
        triple.equation;

    state.status = "SOLVED";

    render();

    clearFeedbackTimeout();

    feedbackTimeoutId =
        window.setTimeout(() => {
            feedbackTimeoutId = null;
            clearSelection();

            generateNextFlowPuzzle();
        }, STRIKE_FEEDBACK_DELAY);
}

/*
====================================================
SCORING AND MISS
====================================================
*/

function awardCorrect(player) {
    player.correct += 1;
    player.score += 1;

    player.currentStreak += 1;

    player.bestStreak =
        Math.max(
            player.bestStreak,
            player.currentStreak
        );

    state.totalCorrect += 1;
}

function handleMiss(player) {
    player.currentStreak = 0;

    state.matchedTargetIndex =
        null;

    state.status =
        "TRY_AGAIN";

    render();

    clearFeedbackTimeout();

    feedbackTimeoutId =
        window.setTimeout(() => {
            feedbackTimeoutId = null;

            clearSelection();

            if (!isFlowMode()) {
                advancePlayer(1);
            }

            state.status = "OPEN";

            render();
        }, MISS_FEEDBACK_DELAY);
}

/*
====================================================
DEMO CONTROLS
====================================================
*/

function revealAnswer() {
    if (!puzzleExists()) {
        window.alert(
            "Generate a puzzle first."
        );

        return;
    }

    const triples =
        isFlowMode()
            ? (
                typeof puzzleEngine.findCombinations ===
                    "function"
                    ? puzzleEngine
                        .findCombinations(
                            state.puzzle,
                            state.settings.requiredAddends,
                            state.struckIndexes,
                            getOperation()
                        )
                    : puzzleEngine
                        .findAdditionCombinations(
                            state.puzzle,
                            state.settings.requiredAddends,
                            state.struckIndexes
                        )
            )
            : state.validCombinations;

    const triple =
        triples[0];

    if (!triple) {
        state.status =
            "COMPLETE";

        render();
        return;
    }

    stopTimer();

    state.selectedIndexes = [
        ...(triple.addendIndexes || [
            triple.firstIndex,
            triple.secondIndex
        ])
    ];

    state.matchedTargetIndex =
        triple.resultIndex;

    state.equation =
        triple.equation;

    state.status =
        "REVEALED";

    render();
}

function movePlayer(direction) {
    clearFeedbackTimeout();
    clearSelection();
    advancePlayer(direction);

    if (puzzleExists()) {
        state.status = "OPEN";
    }

    render();
}

function resetBoard() {
    clearFeedbackTimeout();
    stopTimer();
    resetPuzzleState();
    resetTimerToDuration();
    render();
}

function resetScores() {
    const confirmed =
        window.confirm(
            "Reset all player scores to zero? Player names and the current board will be kept."
        );

    if (!confirmed) {
        return;
    }

    state.players.forEach(player => {
        player.score = 0;
        player.attempts = 0;
        player.correct = 0;
        player.currentStreak = 0;
        player.bestStreak = 0;
    });

    render();
}

/*
====================================================
SETTINGS
====================================================
*/

function updatePlayerCount() {
    const count =
        Number.parseInt(
            elements.playerCount.value,
            10
        );

    if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > PLAYER_LIMIT
    ) {
        return;
    }

    state.playerCount = count;

    if (
        state.activePlayerIndex >=
        count
    ) {
        state.activePlayerIndex = 0;
    }

    render();
}

function updateGridSize() {
    const previousGridSize =
        state.settings.gridSize;

    const previousRequiredAddends =
        state.settings.requiredAddends;

    const settings =
        enforceNumberRangeForGrid();

    state.gridSize = settings.gridSize;
    state.boardSize = settings.boardSize;

    if (
        previousGridSize !==
            settings.gridSize ||
        previousRequiredAddends !==
            settings.requiredAddends
    ) {
        clearFeedbackTimeout();
        stopTimer();
        resetPuzzleState();
        resetTimerToDuration();
    }

    render();
}

function updateRequiredAddends() {
    const previousRequiredAddends =
        state.settings.requiredAddends;

    const settings =
        enforceNumberRangeForGrid();

    if (
        previousRequiredAddends !==
        settings.requiredAddends
    ) {
        clearFeedbackTimeout();
        stopTimer();
        resetPuzzleState();
        resetTimerToDuration();
    }

    render();
}

function updateNumberSettings() {
    enforceNumberRangeForGrid();
    renderSettings();
}

function updateRunningSumSetting() {
    state.settings.showRunningSum =
        Boolean(
            elements.runningSumToggle?.checked
        );

    render();
}

/*
====================================================
TIMER
====================================================
*/

function startTimer() {
    if (
        !state.timer.enabled ||
        !puzzleExists()
    ) {
        return;
    }

    state.timer.running = true;
    state.timer.remaining =
        state.timer.duration;

    state.timer.endTime =
        Date.now() +
        state.timer.duration * 1000;
}

function stopTimer() {
    state.timer.running = false;
    state.timer.endTime = null;
}

function resetTimerToDuration() {
    stopTimer();

    state.timer.remaining =
        state.timer.duration;
}

function getLiveTimerRemaining() {
    if (
        !state.timer.running ||
        !state.timer.endTime
    ) {
        return Math.max(
            0,
            Number(
                state.timer.remaining
            ) || 0
        );
    }

    return Math.max(
        0,
        Math.ceil(
            (
                state.timer.endTime -
                Date.now()
            ) / 1000
        )
    );
}

function updateTimerEnabled() {
    if (isPracticeMode()) {
        state.timer.enabled = false;
        elements.timerToggle.checked = false;
        resetTimerToDuration();
        render();
        return;
    }

    state.timer.enabled =
        elements.timerToggle.checked;

    resetTimerToDuration();

    if (
        state.timer.enabled &&
        state.status === "OPEN" &&
        puzzleExists()
    ) {
        startTimer();
    }

    render();
}

function updateTimerDuration() {
    if (isPracticeMode()) {
        resetTimerToDuration();
        render();
        return;
    }

    const duration =
        Number.parseInt(
            elements.timerDuration.value,
            10
        );

    const allowedDurations = [
        5,
        10,
        15,
        30,
        45,
        60
    ];

    if (
        !allowedDurations.includes(
            duration
        )
    ) {
        return;
    }

    state.timer.duration =
        duration;

    resetTimerToDuration();

    if (
        state.timer.enabled &&
        state.status === "OPEN" &&
        puzzleExists()
    ) {
        startTimer();
    }

    render();
}

function monitorTimer() {
    if (
        !state.timer.running ||
        !state.timer.endTime
    ) {
        return;
    }

    state.timer.remaining =
        getLiveTimerRemaining();

    if (
        state.timer.remaining > 0
    ) {
        renderTimer();
        return;
    }

    state.timer.remaining = 0;
    stopTimer();

    if (isMaxOutMode()) {
        finishMaxOutRound();
    } else {
        clearSelection();
        state.status = "TIME_UP";
        render();
    }
}

function finishMaxOutRound() {
    clearFeedbackTimeout();
    clearSelection();

    state.status = "TIME_UP";
    state.timer.remaining = 0;

    stopTimer();
    render();
}

function formatTimer(seconds) {
    const safeSeconds =
        Math.max(
            0,
            Math.floor(seconds)
        );

    const minutes =
        Math.floor(
            safeSeconds / 60
        );

    const remainingSeconds =
        safeSeconds % 60;

    return (
        String(minutes)
            .padStart(2, "0") +
        ":" +
        String(remainingSeconds)
            .padStart(2, "0")
    );
}

/*
====================================================
RENDERING
====================================================
*/

function render() {
    renderGameMode();
    renderStatus();
    renderPuzzle();
    renderScoreboard();
    renderActivePlayer();
    renderSummary();
    renderSettings();
    renderTimer();
}

function renderStatus() {
    const statusText = {
        WAITING:
            "WAITING FOR PUZZLE",

        OPEN:
            state.selectedIndexes.length > 0
                ? `TARGET LOCKED ${state.selectedIndexes.length}/${state.settings.requiredAddends}`
                : "ROUND OPEN",

        SOLVED:
            "STRIKE",

        COMPLETE:
            "PUZZLE COMPLETE",

        REVEALED:
            "ANSWER REVEALED",

        TRY_AGAIN:
            "MISS",

        TIME_UP:
            "TIME UP"
    };

    elements.sessionStatus.textContent =
        statusText[state.status] ||
        state.status;

    elements.statusCard.classList.toggle(
        "strike",
        state.status === "SOLVED"
    );

    elements.statusCard.classList.toggle(
        "complete",
        state.status === "COMPLETE"
    );

    elements.statusCard.classList.toggle(
        "time-up",
        state.status === "TIME_UP"
    );
}

function syncPuzzleCells() {
    const desiredCellCount =
        state.boardSize ||
        state.settings.gridSize *
        state.settings.gridSize;

    if (
        elements.puzzleCells.length ===
        desiredCellCount
    ) {
        return;
    }

    elements.puzzleBoard.replaceChildren();
    elements.puzzleCells = [];

    for (
        let index = 0;
        index < desiredCellCount;
        index += 1
    ) {
        const cell =
            document.createElement("button");

        cell.className = "puzzle-cell";
        cell.type = "button";
        cell.dataset.index = String(index);
        cell.setAttribute(
            "aria-label",
            `Puzzle number ${index + 1}`
        );

        cell.addEventListener(
            "click",
            handlePuzzleClick
        );

        elements.puzzleCells.push(cell);
        elements.puzzleBoard.append(cell);
    }
}

function getSelectedValues() {
    return state.selectedIndexes.map(
        index => state.puzzle[index]
    );
}

/*
Left-folds the selected values, in click order, with
the current operation. Returns null when the fold is
not a whole number (inexact division), so the display
can show "?" instead of a fraction.
*/
function getSelectedResult() {
    const selectedValues = getSelectedValues();

    if (selectedValues.length === 0) {
        return 0;
    }

    if (
        puzzleEngine &&
        typeof puzzleEngine.computeResult ===
            "function"
    ) {
        return puzzleEngine.computeResult(
            selectedValues.map(
                value => Number(value || 0)
            ),
            getOperation()
        );
    }

    return selectedValues.reduce(
        (total, value) =>
            total + Number(value || 0),
        0
    );
}

// Kept for the running-result display; despite the
// historical name this is now operation-aware.
function getSelectedSum() {
    return getSelectedResult();
}

function buildEquationFromSelection(options = {}) {
    const {
        showRunningSum = false,
        forceResult = false
    } = options;

    const selectedValues =
        getSelectedValues();

    const emptySlots = Array.from(
        {
            length: Math.max(
                0,
                state.settings.requiredAddends -
                selectedValues.length
            )
        },
        () => "?"
    );

    const leftSide =
        [...selectedValues, ...emptySlots]
            .join(` ${getOperationSymbol()} `);

    const shouldShowResult =
        forceResult ||
        (
            showRunningSum &&
            selectedValues.length > 0
        );

    const computedResult = shouldShowResult
        ? getSelectedResult()
        : null;

    const result = shouldShowResult
        ? (
            computedResult === null
                ? "?"
                : computedResult
        )
        : "?";

    return `${leftSide} = ${result}`;
}

function cacheAttemptEquation() {
    state.equation =
        buildEquationFromSelection({
            forceResult: true
        });
}

function renderPuzzle() {
    syncPuzzleCells();

    elements.puzzleBoard.classList.remove(
        "grid-size-2",
        "grid-size-3",
        "grid-size-4",
        "grid-size-5"
    );

    elements.puzzleBoard.classList.add(
        `grid-size-${state.gridSize}`
    );

    elements.puzzleBoard.classList.toggle(
        "strike",
        state.status === "SOLVED"
    );

    elements.puzzleBoard.classList.toggle(
        "wrong",
        state.status === "TRY_AGAIN"
    );

    elements.puzzleBoard.classList.toggle(
        "complete",
        state.status === "COMPLETE"
    );

    elements.puzzleBoard.classList.toggle(
        "time-up",
        state.status === "TIME_UP"
    );

    elements.puzzleCells.forEach(
        (cell, index) => {
            cell.className =
                "puzzle-cell";

            const value =
                state.puzzle[index];

            const selected =
                state.selectedIndexes
                    .includes(index);

            const matched =
                state.matchedTargetIndex ===
                index;

            const struck =
                isFlowMode() &&
                state.struckIndexes
                    .includes(index);

            cell.textContent =
                value === undefined
                    ? ""
                    : String(value);

            cell.disabled =
                !isBoardInteractive() ||
                struck ||
                value === undefined;

            if (selected) {
                cell.classList.add(
                    "selected",
                    "target-locked"
                );
            }

            if (matched) {
                cell.classList.add(
                    "correct",
                    "target-matched"
                );
            }

            if (struck) {
                cell.classList.add(
                    "struck"
                );
            }
        }
    );

    renderEquation();
}

function renderEquation() {
    const runningSumEnabled =
        state.settings.showRunningSum;

    if (
        state.status === "SOLVED" ||
        state.status === "COMPLETE" ||
        state.status === "REVEALED"
    ) {
        elements.equationDisplay.textContent =
            state.equation ||
            "TARGET MATCHED";

        return;
    }

    if (state.status === "TRY_AGAIN") {
        elements.equationDisplay.textContent =
            runningSumEnabled && state.equation
                ? state.equation
                : "MISS — TRY AGAIN";

        return;
    }

    elements.equationDisplay.textContent =
        buildEquationFromSelection({
            showRunningSum: runningSumEnabled
        });
}

function renderScoreboard() {
    elements.scoreboard.replaceChildren();

    state.players
        .slice(0, state.playerCount)
        .forEach(
        (player, index) => {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "player-row";

            const active =
                index ===
                state.activePlayerIndex &&
                index <
                state.playerCount;

            const inactive =
                index >=
                state.playerCount;

            row.classList.toggle(
                "active",
                active
            );

            row.classList.toggle(
                "inactive",
                inactive
            );

            const name =
                document.createElement(
                    "input"
                );

            name.type = "text";
            name.value = player.name;
            name.disabled = inactive;
            name.className =
                "player-name-input";

            name.addEventListener(
                "change",
                event => {
                    player.name =
                        event.target.value.trim() ||
                        `Player ${index + 1}`;

                    render();
                }
            );

            const score =
                document.createElement(
                    "span"
                );

            score.textContent =
                String(player.score);

            const turn =
                document.createElement(
                    "span"
                );

            turn.textContent =
                active
                    ? "▶"
                    : "";

            row.append(
                name,
                score,
                turn
            );

            elements.scoreboard.append(
                row
            );
        }
    );
}

function renderActivePlayer() {
    if (elements.activePlayerLabel) {
        elements.activePlayerLabel.textContent =
            isPracticeMode()
                ? "TRAINING MODE"
                : "ACTIVE AGENT";
    }

    elements.activePlayerName.textContent =
        isPracticeMode()
            ? "Practice Mode"
            : getActivePlayer()?.name ||
                "Player 1";
}

function renderSummary() {
    elements.totalPuzzles.textContent =
        String(state.totalPuzzles);

    elements.totalAttempts.textContent =
        String(state.totalAttempts);

    elements.totalCorrect.textContent =
        String(state.totalCorrect);

    elements.classAccuracy.textContent =
        state.totalAttempts === 0
            ? "—"
            : (
                (
                    state.totalCorrect /
                    state.totalAttempts
                ) * 100
            ).toFixed(2) + "%";
}

function renderSettings() {
    if (elements.operation) {
        elements.operation.value =
            getOperation();
    }

    if (elements.allowNegativesToggle) {
        elements.allowNegativesToggle.checked =
            state.settings.allowNegatives;
    }

    elements.minimumNumber.min =
        String(getMinimumFloor());

    elements.playerCount.value =
        String(state.playerCount);

    elements.gridSize.value =
        String(state.settings.gridSize);

    syncRequiredAddendsOptions(
        state.settings.gridSize
    );

    elements.requiredAddends.value =
        String(state.settings.requiredAddends);

    const requiredMaximum =
        getRequiredMaximumForSettings(
            state.settings.minimumNumber,
            state.settings.gridSize,
            state.settings.requiredAddends
        );

    elements.maximumNumber.min =
        String(requiredMaximum);

    elements.minimumNumber.value =
        String(
            state.settings.minimumNumber
        );

    elements.maximumNumber.value =
        String(
            state.settings.maximumNumber
        );

    if (elements.runningSumToggle) {
        elements.runningSumToggle.checked =
            state.settings.showRunningSum;
    }

    elements.timerToggle.checked =
        state.timer.enabled;

    elements.timerDuration.value =
        String(state.timer.duration);

    elements.playerCount.disabled =
        isPracticeMode();

    elements.previousPlayerButton.disabled =
        isPracticeMode();

    elements.nextPlayerButton.disabled =
        isPracticeMode();

    elements.timerToggle.disabled =
        isPracticeMode();

    elements.timerDuration.disabled =
        isPracticeMode();
}

function renderTimer() {
    const duration =
        Math.max(
            1,
            state.timer.duration
        );

    const remaining =
        getLiveTimerRemaining();

    const degrees =
        Math.max(
            0,
            Math.min(
                360,
                (
                    remaining /
                    duration
                ) * 360
            )
        );

    elements.timerDisplay.textContent =
        formatTimer(remaining);

    elements.timerRing.style.setProperty(
        "--timer-progress",
        `${degrees}deg`
    );

    elements.timerToggleLabel.textContent =
        state.timer.enabled
            ? "ON"
            : "OFF";

    elements.timerCard.classList.toggle(
        "timer-disabled",
        !state.timer.enabled
    );

    elements.timerCard.classList.toggle(
        "time-up",
        state.status === "TIME_UP"
    );

    if (isPracticeMode()) {
        elements.timerCaption.textContent =
            "NO TIMER";
    } else if (
        state.status === "TIME_UP"
    ) {
        elements.timerCaption.textContent =
            "TIME EXPIRED";
    } else if (!state.timer.enabled) {
        elements.timerCaption.textContent =
            "TIMER OFF";
    } else if (state.timer.running) {
        elements.timerCaption.textContent =
            "TIME REMAINING";
    } else if (
        ["SOLVED", "COMPLETE", "REVEALED"]
            .includes(state.status)
    ) {
        elements.timerCaption.textContent =
            "TIMER STOPPED";
    } else {
        elements.timerCaption.textContent =
            "READY";
    }
}

/*
====================================================
EVENTS
====================================================
*/

function connectEvents() {
    elements.gameMode.addEventListener(
        "change",
        updateGameMode
    );

    if (elements.operation) {
        elements.operation.addEventListener(
            "change",
            updateOperation
        );
    }

    if (elements.allowNegativesToggle) {
        elements.allowNegativesToggle.addEventListener(
            "change",
            updateAllowNegatives
        );
    }

    elements.newPuzzleButton.addEventListener(
        "click",
        () => {
            generatePuzzle();
        }
    );

    elements.revealButton.addEventListener(
        "click",
        revealAnswer
    );

    elements.previousPlayerButton
        .addEventListener(
            "click",
            () => movePlayer(-1)
        );

    elements.nextPlayerButton
        .addEventListener(
            "click",
            () => movePlayer(1)
        );

    elements.resetScoresButton
        .addEventListener(
            "click",
            resetScores
        );

    elements.resetBoardButton
        .addEventListener(
            "click",
            resetBoard
        );

    elements.playerCount.addEventListener(
        "change",
        updatePlayerCount
    );

    elements.gridSize.addEventListener(
        "change",
        updateGridSize
    );

    elements.requiredAddends.addEventListener(
        "change",
        updateRequiredAddends
    );

    if (elements.runningSumToggle) {
        elements.runningSumToggle.addEventListener(
            "change",
            updateRunningSumSetting
        );
    }

    elements.minimumNumber.addEventListener(
        "change",
        updateNumberSettings
    );

    elements.maximumNumber.addEventListener(
        "change",
        updateNumberSettings
    );

    elements.timerToggle.addEventListener(
        "change",
        updateTimerEnabled
    );

    elements.timerDuration.addEventListener(
        "change",
        updateTimerDuration
    );

    timerIntervalId =
        window.setInterval(
            monitorTimer,
            200
        );

    window.addEventListener(
        "beforeunload",
        () => {
            clearFeedbackTimeout();

            if (
                timerIntervalId !== null
            ) {
                window.clearInterval(
                    timerIntervalId
                );
            }
        }
    );
}

/*
====================================================
STARTUP
====================================================
*/

function startDemo() {
    connectEvents();
    render();
}

startDemo();