"use strict";

const stateApi = window.OperationHuntState;
const puzzleEngine = window.OperationHuntPuzzleEngine;

if (!stateApi) {
    throw new Error("OperationHuntState did not load.");
}

if (!puzzleEngine) {
    throw new Error("OperationHuntPuzzleEngine did not load.");
}

const state = stateApi.getState();
const PLAYER_LIMIT = stateApi.MAX_PLAYERS;
const STRIKE_FEEDBACK_DELAY = 900;
const MISS_FEEDBACK_DELAY = 650;

const elements = {
    gameMode: document.querySelector("#game-mode"),
    gameModeDescription: document.querySelector("#game-mode-description"),
    teacherModeLabel: document.querySelector("#teacher-mode-label"),

    sessionStatus: document.querySelector("#session-status"),
    statusCard: document.querySelector(".teacher-status-card"),
    activePlayerName: document.querySelector("#active-player-name"),

    newPuzzleButton: document.querySelector("#new-puzzle-button"),
    revealButton: document.querySelector("#reveal-button"),
    previousPlayerButton: document.querySelector("#previous-player-button"),
    nextPlayerButton: document.querySelector("#next-player-button"),
    resetSessionButton: document.querySelector("#reset-session-button"),
    resetBoardButton: document.querySelector("#reset-board-button"),

    playerCount: document.querySelector("#player-count"),
    gridSize: document.querySelector("#grid-size"),
    requiredAddends: document.querySelector("#required-addends"),
    runningSumToggle: document.querySelector("#running-sum-toggle"),
    minimumNumber: document.querySelector("#minimum-number"),
    maximumNumber: document.querySelector("#maximum-number"),

    timerCard: document.querySelector("#timer-card"),
    timerToggle: document.querySelector("#timer-toggle"),
    timerToggleLabel: document.querySelector("#timer-toggle-label"),
    timerDuration: document.querySelector("#timer-duration"),
    timerDisplay: document.querySelector("#timer-display"),
    timerCaption: document.querySelector("#timer-caption"),

    totalPuzzles: document.querySelector("#total-puzzles"),
    totalAttempts: document.querySelector("#total-attempts"),
    totalCorrect: document.querySelector("#total-correct"),
    classAccuracy: document.querySelector("#class-accuracy"),

    performanceTable: document.querySelector("#performance-table"),
    currentPuzzleDisplay: document.querySelector("#current-puzzle-display"),
    correctEquationDisplay: document.querySelector("#correct-equation-display"),
    currentTurnDisplay: document.querySelector("#current-turn-display")
};

function saveState(reason) {
    stateApi.saveState({ reason });
}

function isMaxOutMode() {
    return state.gameMode === stateApi.GAME_MODES.MAX_OUT;
}

function isPracticeMode() {
    return state.gameMode === stateApi.GAME_MODES.PRACTICE;
}

function isFlowMode() {
    return isMaxOutMode() || isPracticeMode();
}

function puzzleExists() {
    return Array.isArray(state.puzzle) && state.puzzle.length > 0;
}

function getActivePlayer() {
    return state.players[state.activePlayerIndex] || state.players[0];
}

function formatTimer(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getLiveTimerRemaining() {
    if (!state.timer.running || !state.timer.endTime) {
        return Math.max(0, Number(state.timer.remaining) || 0);
    }

    return Math.max(0, Math.ceil((state.timer.endTime - Date.now()) / 1000));
}

function resetTimerToDuration() {
    state.timer.running = false;
    state.timer.endTime = null;
    state.timer.remaining = state.timer.duration;
}

function stopTimer() {
    state.timer.running = false;
    state.timer.endTime = null;
}

function startTimer() {
    if (!state.timer.enabled || isPracticeMode() || !puzzleExists()) {
        return;
    }

    state.timer.running = true;
    state.timer.remaining = state.timer.duration;
    state.timer.endTime = Date.now() + state.timer.duration * 1000;
}

function getRequiredMaximumForSettings(minimum, gridSize, requiredAddends) {
    const boardSize = Number(gridSize) * Number(gridSize);

    if (puzzleEngine.getMinimumMaximumForPuzzle) {
        return puzzleEngine.getMinimumMaximumForPuzzle(
            minimum,
            boardSize,
            requiredAddends
        );
    }

    return minimum + boardSize - 1;
}

function syncRequiredAddendsOptions(gridSize) {
    const allowed = puzzleEngine.getAllowedRequiredAddends
        ? puzzleEngine.getAllowedRequiredAddends(gridSize)
        : [2];

    const current = Number(elements.requiredAddends.value || state.settings.requiredAddends || 2);

    elements.requiredAddends.replaceChildren();

    allowed.forEach(value => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value} Terms`;
        elements.requiredAddends.append(option);
    });

    const nextValue = allowed.includes(current)
        ? current
        : allowed[allowed.length - 1];

    elements.requiredAddends.value = String(nextValue);
    state.settings.requiredAddends = nextValue;
}

function readNumberSettings() {
    const gridSize = Number.parseInt(elements.gridSize.value, 10);
    syncRequiredAddendsOptions(gridSize);

    const requiredAddends = Number.parseInt(elements.requiredAddends.value, 10);
    const minimum = Number.parseInt(elements.minimumNumber.value, 10);
    let maximum = Number.parseInt(elements.maximumNumber.value, 10);
    const boardSize = gridSize * gridSize;

    if (!Number.isInteger(minimum) || minimum < 1) {
        throw new Error("Minimum number must be a whole number 1 or greater.");
    }

    const requiredMaximum = getRequiredMaximumForSettings(
        minimum,
        gridSize,
        requiredAddends
    );

    if (!Number.isInteger(maximum) || maximum < requiredMaximum) {
        maximum = requiredMaximum;
        elements.maximumNumber.value = String(maximum);
    }

    state.settings.gridSize = gridSize;
    state.settings.requiredAddends = requiredAddends;
    state.settings.minimumNumber = minimum;
    state.settings.maximumNumber = maximum;
    state.settings.showRunningSum = Boolean(elements.runningSumToggle?.checked);

    elements.maximumNumber.min = String(requiredMaximum);

    return {
        gridSize,
        requiredAddends,
        minimum,
        maximum,
        boardSize
    };
}

function clearSelection() {
    state.selectedIndexes = [];
    state.matchedTargetIndex = null;
    state.struckIndexes = [];
    state.completedTriples = [];
    state.equation = "";
    state.maxOut.currentTriple = null;
    state.maxOut.feedback = null;
    state.maxOut.equationValues = {
        first: null,
        second: null,
        result: null
    };
}

function resetPuzzleState() {
    state.puzzle = [];
    state.gridSize = state.settings.gridSize;
    state.boardSize = state.gridSize * state.gridSize;
    clearSelection();
    state.validTriples = [];
    state.validCombinations = [];
    state.correctAddends = [];
    state.sum = null;
    state.status = "WAITING";
}

function advancePlayer(direction = 1) {
    if (isPracticeMode()) {
        return;
    }

    const count = Math.max(1, state.playerCount);
    state.activePlayerIndex = (state.activePlayerIndex + direction + count) % count;
}

function generatePuzzle(options = {}) {
    const { advanceTurn = true, preserveTimer = false } = options;
    let settings;

    try {
        settings = readNumberSettings();
    } catch (error) {
        window.alert(error.message);
        return;
    }

    if (advanceTurn && puzzleExists() && !isPracticeMode()) {
        advancePlayer(1);
    }

    if (!preserveTimer) {
        stopTimer();
    }

    try {
        const generated = puzzleEngine.createNumberPuzzle({
            minimum: settings.minimum,
            maximum: settings.maximum,
            gridSize: settings.gridSize,
            requiredAddends: settings.requiredAddends
        });

        const primaryCombo = (generated.combinations || generated.triples || [])[0];

        state.puzzle = [...generated.numbers];
        state.gridSize = generated.gridSize;
        state.boardSize = generated.boardSize;
        state.selectedIndexes = [];
        state.struckIndexes = [];
        state.matchedTargetIndex = null;
        state.completedTriples = [];
        state.validTriples = [...(generated.triples || [])];
        state.validCombinations = [...(generated.combinations || generated.triples || [])];
        state.correctAddends = primaryCombo ? [...primaryCombo.addendValues] : [];
        state.sum = primaryCombo ? primaryCombo.resultValue : null;
        state.equation = primaryCombo ? primaryCombo.equation : "";
        state.status = "OPEN";
        state.totalPuzzles += 1;
        state.maxOut.puzzlesPresented += isMaxOutMode() ? 1 : 0;
        state.maxOut.roundStatus = isFlowMode()
            ? stateApi.ROUND_STATUSES.ACTIVE
            : state.maxOut.roundStatus;
        state.maxOut.feedback = null;
        state.maxOut.currentTriple = null;
        state.maxOut.puzzleComplete = false;
        state.maxOut.remainingTripleCount = state.validCombinations.length;

        if (!preserveTimer) {
            if (state.timer.enabled && !isPracticeMode()) {
                startTimer();
            } else {
                resetTimerToDuration();
            }
        }

        saveState("teacher-generated-puzzle");
        render();
    } catch (error) {
        console.error("Puzzle generation failed:", error);
        window.alert(error.message);
    }
}

function revealAnswer() {
    if (!puzzleExists()) {
        window.alert("Generate a puzzle first.");
        return;
    }

    const combos = puzzleEngine.findAdditionCombinations(
        state.puzzle,
        state.settings.requiredAddends,
        []
    );

    const combo = combos[0];

    if (!combo) {
        state.status = "COMPLETE";
        saveState("teacher-no-answer-found");
        render();
        return;
    }

    stopTimer();

    state.selectedIndexes = [...combo.addendIndexes];
    state.matchedTargetIndex = combo.resultIndex;
    state.maxOut.currentTriple = combo;
    state.equation = combo.equation;
    state.status = "REVEALED";

    saveState("teacher-revealed-answer");
    render();
}

function movePlayer(direction) {
    clearSelection();
    advancePlayer(direction);

    if (puzzleExists()) {
        state.status = "OPEN";
    }

    saveState("teacher-player-changed");
    render();
}

function resetBoard() {
    stopTimer();
    resetPuzzleState();
    resetTimerToDuration();
    saveState("teacher-reset-board");
    render();
}

function resetSession() {
    const confirmed = window.confirm("Reset all scores and session data?");

    if (!confirmed) {
        return;
    }

    stopTimer();
    state.players = Array.from({ length: PLAYER_LIMIT }, (_, index) => ({
        name: `Player ${index + 1}`,
        score: 0,
        attempts: 0,
        correct: 0,
        currentStreak: 0,
        bestStreak: 0,
        roundStatus: stateApi.ROUND_STATUSES.NOT_STARTED
    }));
    state.totalPuzzles = 0;
    state.totalAttempts = 0;
    state.totalCorrect = 0;
    state.activePlayerIndex = 0;
    state.practice = {
        puzzlesAttempted: 0,
        strikes: 0,
        misses: 0,
        currentStreak: 0,
        bestStreak: 0
    };
    resetPuzzleState();
    resetTimerToDuration();
    saveState("teacher-reset-session");
    render();
}

function updateGameMode() {
    const changed = stateApi.setGameMode(elements.gameMode.value);

    if (!changed) {
        elements.gameMode.value = state.gameMode;
        return;
    }

    if (isPracticeMode()) {
        state.timer.enabled = false;
        stopTimer();
    }

    saveState("teacher-mode-updated");
    render();
}

function updatePlayerCount() {
    const count = Number.parseInt(elements.playerCount.value, 10);

    if (!Number.isInteger(count) || count < 1 || count > PLAYER_LIMIT) {
        return;
    }

    state.playerCount = count;

    if (state.activePlayerIndex >= count) {
        state.activePlayerIndex = 0;
    }

    saveState("teacher-player-count-updated");
    render();
}

function updateGridSize() {
    readNumberSettings();
    resetPuzzleState();
    resetTimerToDuration();
    saveState("teacher-grid-size-updated");
    render();
}

function updateRequiredAddends() {
    readNumberSettings();
    resetPuzzleState();
    resetTimerToDuration();
    saveState("teacher-terms-updated");
    render();
}

function updateNumberSettings() {
    readNumberSettings();
    saveState("teacher-number-range-updated");
    render();
}

function updateRunningSum() {
    state.settings.showRunningSum = Boolean(elements.runningSumToggle?.checked);
    saveState("teacher-running-sum-updated");
    render();
}

function updateTimerToggle() {
    state.timer.enabled = Boolean(elements.timerToggle.checked) && !isPracticeMode();

    if (!state.timer.enabled) {
        resetTimerToDuration();
    } else if (puzzleExists() && state.status === "OPEN") {
        startTimer();
    }

    saveState("teacher-timer-toggle-updated");
    render();
}

function updateTimerDuration() {
    state.timer.duration = Number.parseInt(elements.timerDuration.value, 10) || 30;
    resetTimerToDuration();
    saveState("teacher-timer-duration-updated");
    render();
}

function getGrade(percent) {
    if (percent >= 97) return "A+";
    if (percent >= 93) return "A";
    if (percent >= 90) return "A-";
    if (percent >= 87) return "B+";
    if (percent >= 83) return "B";
    if (percent >= 80) return "B-";
    if (percent >= 77) return "C+";
    if (percent >= 73) return "C";
    if (percent >= 70) return "C-";
    if (percent >= 60) return "D";
    return "F";
}

function renderGameMode() {
    const labels = {
        CLASSIC: "Classic Mission",
        MAX_OUT: "Max Out Challenge",
        PRACTICE: "Practice Mode"
    };

    const descriptions = {
        CLASSIC: "Turn-based hunt. Find the selected terms that equal a target on the board.",
        MAX_OUT: "Timed flow. STRIKE loads the next puzzle; MISS keeps the same puzzle.",
        PRACTICE: "Endless untimed practice with stats, no players, and no turn switching."
    };

    document.body.classList.toggle("mode-classic", state.gameMode === stateApi.GAME_MODES.CLASSIC);
    document.body.classList.toggle("mode-max-out", isMaxOutMode());
    document.body.classList.toggle("mode-practice", isPracticeMode());

    elements.gameMode.value = state.gameMode;
    elements.teacherModeLabel.textContent = labels[state.gameMode] || state.gameMode;
    elements.gameModeDescription.textContent = descriptions[state.gameMode] || "";
}

function renderSettings() {
    elements.playerCount.value = String(state.playerCount);
    elements.gridSize.value = String(state.settings.gridSize);
    syncRequiredAddendsOptions(state.settings.gridSize);
    elements.requiredAddends.value = String(state.settings.requiredAddends);

    const requiredMaximum = getRequiredMaximumForSettings(
        state.settings.minimumNumber,
        state.settings.gridSize,
        state.settings.requiredAddends
    );

    elements.maximumNumber.min = String(requiredMaximum);
    elements.minimumNumber.value = String(state.settings.minimumNumber);
    elements.maximumNumber.value = String(Math.max(state.settings.maximumNumber, requiredMaximum));
    elements.runningSumToggle.checked = Boolean(state.settings.showRunningSum);
    elements.timerToggle.checked = Boolean(state.timer.enabled) && !isPracticeMode();
    elements.timerDuration.value = String(state.timer.duration);

    elements.playerCount.disabled = isPracticeMode();
    elements.previousPlayerButton.disabled = isPracticeMode();
    elements.nextPlayerButton.disabled = isPracticeMode();
    elements.timerToggle.disabled = isPracticeMode();
    elements.timerDuration.disabled = isPracticeMode();
}

function renderStatus() {
    const statusText = {
        WAITING: "WAITING FOR PUZZLE",
        OPEN: "ROUND OPEN",
        SOLVED: "STRIKE",
        COMPLETE: "PUZZLE COMPLETE",
        REVEALED: "ANSWER REVEALED",
        TRY_AGAIN: "MISS",
        TIME_UP: "TIME UP"
    };

    elements.sessionStatus.textContent = statusText[state.status] || state.status;
    elements.statusCard.classList.toggle("strike", state.status === "SOLVED");
    elements.statusCard.classList.toggle("time-up", state.status === "TIME_UP");
    elements.statusCard.classList.toggle("complete", state.status === "COMPLETE");
}

function renderActivePlayer() {
    elements.activePlayerName.textContent = isPracticeMode()
        ? "Practice Mode"
        : getActivePlayer()?.name || "Player 1";
}

function renderSummary() {
    elements.totalPuzzles.textContent = String(state.totalPuzzles);
    elements.totalAttempts.textContent = String(state.totalAttempts);
    elements.totalCorrect.textContent = String(state.totalCorrect);
    elements.classAccuracy.textContent = state.totalAttempts === 0
        ? "—"
        : `${((state.totalCorrect / state.totalAttempts) * 100).toFixed(2)}%`;
}

function renderPerformanceTable() {
    elements.performanceTable.replaceChildren();

    state.players.forEach((player, index) => {
        const row = document.createElement("div");
        row.className = "performance-row";

        const active = index === state.activePlayerIndex && index < state.playerCount && !isPracticeMode();
        const inactive = index >= state.playerCount || isPracticeMode();

        row.classList.toggle("active", active);
        row.classList.toggle("inactive", inactive);

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = player.name;
        nameInput.disabled = inactive;
        nameInput.addEventListener("change", event => {
            player.name = event.target.value.trim() || `Player ${index + 1}`;
            saveState("teacher-player-name-updated");
            render();
        });

        const attempts = Number(player.attempts) || 0;
        const correct = Number(player.correct) || 0;
        const percent = attempts === 0 ? null : (correct / attempts) * 100;

        const values = [
            nameInput,
            String(player.score),
            active ? "▶" : "",
            String(attempts),
            String(correct),
            percent === null ? "—" : `${percent.toFixed(2)}%`,
            percent === null ? "—" : getGrade(percent)
        ];

        values.forEach(value => {
            if (value instanceof HTMLElement) {
                row.append(value);
                return;
            }

            const span = document.createElement("span");
            span.textContent = value;
            row.append(span);
        });

        elements.performanceTable.append(row);
    });
}

function renderSessionDetails() {
    elements.currentPuzzleDisplay.textContent = puzzleExists()
        ? `${state.gridSize}×${state.gridSize}: ${state.puzzle.join(", ")}`
        : "No puzzle generated";

    elements.correctEquationDisplay.textContent = state.equation || "Hidden";
    elements.currentTurnDisplay.textContent = isPracticeMode()
        ? "Practice Mode"
        : getActivePlayer()?.name || "Player 1";
}

function renderTimer() {
    elements.timerDisplay.textContent = formatTimer(getLiveTimerRemaining());
    elements.timerToggleLabel.textContent = state.timer.enabled && !isPracticeMode() ? "ON" : "OFF";

    elements.timerCard.classList.toggle("timer-disabled", !state.timer.enabled || isPracticeMode());
    elements.timerCard.classList.toggle("time-up", state.status === "TIME_UP");

    if (isPracticeMode()) {
        elements.timerCaption.textContent = "PRACTICE MODE";
    } else if (state.status === "TIME_UP") {
        elements.timerCaption.textContent = "TIME EXPIRED";
    } else if (!state.timer.enabled) {
        elements.timerCaption.textContent = "TIMER OFF";
    } else if (state.timer.running) {
        elements.timerCaption.textContent = "TIME REMAINING";
    } else {
        elements.timerCaption.textContent = "READY";
    }
}

function monitorTimer() {
    if (!state.timer.running || !state.timer.endTime || isPracticeMode()) {
        return;
    }

    if (getLiveTimerRemaining() > 0) {
        return;
    }

    state.timer.remaining = 0;
    state.timer.running = false;
    state.timer.endTime = null;
    state.status = "TIME_UP";
    saveState("teacher-time-up");
    render();
}

function render() {
    renderGameMode();
    renderStatus();
    renderActivePlayer();
    renderSummary();
    renderPerformanceTable();
    renderSessionDetails();
    renderSettings();
    renderTimer();
}

function connectEvents() {
    elements.gameMode.addEventListener("change", updateGameMode);
    elements.newPuzzleButton.addEventListener("click", () => generatePuzzle());
    elements.revealButton.addEventListener("click", revealAnswer);
    elements.previousPlayerButton.addEventListener("click", () => movePlayer(-1));
    elements.nextPlayerButton.addEventListener("click", () => movePlayer(1));
    elements.resetSessionButton.addEventListener("click", resetSession);
    elements.resetBoardButton.addEventListener("click", resetBoard);

    elements.playerCount.addEventListener("change", updatePlayerCount);
    elements.gridSize.addEventListener("change", updateGridSize);
    elements.requiredAddends.addEventListener("change", updateRequiredAddends);
    elements.minimumNumber.addEventListener("change", updateNumberSettings);
    elements.maximumNumber.addEventListener("change", updateNumberSettings);
    elements.runningSumToggle.addEventListener("change", updateRunningSum);
    elements.timerToggle.addEventListener("change", updateTimerToggle);
    elements.timerDuration.addEventListener("change", updateTimerDuration);

    stateApi.subscribe(() => {
        render();
    });

    window.setInterval(() => {
        monitorTimer();
        if (state.timer.running) {
            renderTimer();
        }
    }, 200);
}

connectEvents();
render();
