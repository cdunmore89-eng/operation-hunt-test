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
const STRIKE_FEEDBACK_DELAY = 900;
const MISS_FEEDBACK_DELAY = 650;

const elements = {
    puzzleBoard: document.querySelector("#puzzle-board"),
    puzzleCells: [...document.querySelectorAll(".puzzle-cell")],
    scoreboard: document.querySelector("#scoreboard"),
    activePlayerName: document.querySelector("#active-player-name"),
    equationDisplay: document.querySelector("#equation-display"),
    sessionStatus: document.querySelector("#session-status"),
    statusCard: document.querySelector(".status-card"),
    totalPuzzles: document.querySelector("#total-puzzles"),
    totalAttempts: document.querySelector("#total-attempts"),
    totalCorrect: document.querySelector("#total-correct"),
    classAccuracy: document.querySelector("#class-accuracy"),
    timerCard: document.querySelector("#timer-card"),
    timerToggleLabel: document.querySelector("#timer-toggle-label"),
    timerRing: document.querySelector("#timer-ring"),
    timerDisplay: document.querySelector("#timer-display"),
    timerCaption: document.querySelector("#timer-caption"),
    modeLabel: document.querySelector(".brand-mode"),
    instructionText: document.querySelector(".smartboard-instruction-panel p"),
    activePlayerLabel: document.querySelector(".smartboard-active-card span")
};

let feedbackTimeoutId = null;
let timerVisualIntervalId = null;

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

function isBoardInteractive() {
    return state.status === "OPEN" && puzzleExists();
}

function clearFeedbackTimeout() {
    if (feedbackTimeoutId !== null) {
        window.clearTimeout(feedbackTimeoutId);
        feedbackTimeoutId = null;
    }
}

function clearSelection() {
    state.selectedIndexes = [];
    state.matchedTargetIndex = null;
}

function advancePlayer(direction = 1) {
    if (isPracticeMode()) {
        return;
    }

    const playerCount = Math.max(1, state.playerCount);
    state.activePlayerIndex = (state.activePlayerIndex + direction + playerCount) % playerCount;
}

function getSelectedValues() {
    return state.selectedIndexes.map(index => state.puzzle[index]);
}

function getSelectedSum() {
    return getSelectedValues().reduce((total, value) => total + Number(value || 0), 0);
}

function buildEquationFromSelection(options = {}) {
    const { showRunningSum = false, forceResult = false } = options;
    const selectedValues = getSelectedValues();
    const requiredAddends = Number(state.settings.requiredAddends) || 2;
    const emptySlots = Array.from(
        { length: Math.max(0, requiredAddends - selectedValues.length) },
        () => "?"
    );
    const leftSide = [...selectedValues, ...emptySlots].join(" + ");
    const shouldShowResult = forceResult || (showRunningSum && selectedValues.length > 0);
    const result = shouldShowResult ? getSelectedSum() : "?";

    return `${leftSide} = ${result}`;
}

function cacheAttemptEquation() {
    state.equation = buildEquationFromSelection({ forceResult: true });
}

function stopSharedTimer() {
    state.timer.running = false;
    state.timer.endTime = null;
}

function startSharedTimer() {
    if (!state.timer.enabled || isPracticeMode() || state.status !== "OPEN" || !puzzleExists()) {
        return;
    }

    state.timer.running = true;
    state.timer.remaining = state.timer.duration;
    state.timer.endTime = Date.now() + state.timer.duration * 1000;
}

function getLiveTimerRemaining() {
    if (!state.timer.running || !state.timer.endTime) {
        return Math.max(0, Number(state.timer.remaining) || 0);
    }

    return Math.max(0, Math.ceil((state.timer.endTime - Date.now()) / 1000));
}

function formatTimer(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function generateNextFlowPuzzle() {
    if (isPracticeMode()) {
        generateFlowPuzzle({ preserveTimer: true });
        return;
    }

    if (!state.timer.enabled || getLiveTimerRemaining() <= 0) {
        finishMaxOutRound();
        return;
    }

    generateFlowPuzzle({ preserveTimer: true });
}

function generateFlowPuzzle(options = {}) {
    const { preserveTimer = true } = options;

    try {
        const generated = puzzleEngine.createNumberPuzzle({
            minimum: state.settings.minimumNumber,
            maximum: state.settings.maximumNumber,
            gridSize: state.settings.gridSize,
            requiredAddends: state.settings.requiredAddends
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
        state.maxOut.roundStatus = stateApi.ROUND_STATUSES.ACTIVE;
        state.maxOut.feedback = null;
        state.maxOut.currentTriple = null;
        state.maxOut.puzzleComplete = false;
        state.maxOut.remainingTripleCount = state.validCombinations.length;

        if (!preserveTimer && state.timer.enabled && !isPracticeMode()) {
            startSharedTimer();
        }

        saveState("smartboard-next-flow-puzzle");
    } catch (error) {
        console.error("Could not generate next flow puzzle:", error);
        if (isMaxOutMode()) {
            finishMaxOutRound();
        }
    }
}

function finishMaxOutRound() {
    clearFeedbackTimeout();
    clearSelection();
    state.status = "TIME_UP";
    state.maxOut.roundStatus = stateApi.ROUND_STATUSES.COMPLETE;
    state.maxOut.puzzleComplete = true;
    state.maxOut.remainingTripleCount = 0;
    state.maxOut.feedback = "TIME_UP";
    state.timer.remaining = 0;
    stopSharedTimer();
    getActivePlayer().roundStatus = stateApi.ROUND_STATUSES.COMPLETE;
    saveState("smartboard-maxout-complete");
}

function handlePuzzleClick(event) {
    const index = Number.parseInt(event.currentTarget.dataset.index, 10);

    if (!Number.isInteger(index) || !isBoardInteractive()) {
        return;
    }

    if (state.selectedIndexes.includes(index)) {
        state.selectedIndexes = state.selectedIndexes.filter(selectedIndex => selectedIndex !== index);
        state.equation = "";
        saveState("smartboard-target-unlocked");
        render();
        return;
    }

    if (state.selectedIndexes.length >= state.settings.requiredAddends) {
        return;
    }

    state.selectedIndexes.push(index);
    state.maxOut.feedback = "TARGET_LOCKED";

    if (state.selectedIndexes.length === state.settings.requiredAddends) {
        checkAnswer();
    } else {
        saveState("smartboard-target-locked");
    }

    render();
}

function checkAnswer() {
    const activePlayer = getActivePlayer();

    if (!isPracticeMode()) {
        activePlayer.attempts += 1;
    }

    state.totalAttempts += 1;
    cacheAttemptEquation();

    if (isPracticeMode()) {
        state.practice.puzzlesAttempted += 1;
    }

    const combo = puzzleEngine.findComboForSelection(
        state.puzzle,
        state.selectedIndexes,
        state.settings.requiredAddends,
        []
    );

    if (!combo) {
        handleMiss(activePlayer);
        return;
    }

    handleStrike(activePlayer, combo);
}

function awardCorrect(activePlayer) {
    if (!isPracticeMode()) {
        activePlayer.correct += 1;
        activePlayer.score += 1;
        activePlayer.currentStreak += 1;
        activePlayer.bestStreak = Math.max(activePlayer.bestStreak, activePlayer.currentStreak);
    }

    state.totalCorrect += 1;

    if (isPracticeMode()) {
        state.practice.strikes += 1;
        state.practice.currentStreak += 1;
        state.practice.bestStreak = Math.max(state.practice.bestStreak, state.practice.currentStreak);
    }
}

function handleStrike(activePlayer, combo) {
    awardCorrect(activePlayer);

    state.matchedTargetIndex = combo.resultIndex;
    state.completedTriples = [{ ...combo }];
    state.maxOut.currentTriple = combo;
    state.maxOut.feedback = "STRIKE";
    state.maxOut.equationValues = {
        first: combo.addendValues?.[0] ?? null,
        second: combo.addendValues?.[1] ?? null,
        result: combo.resultValue
    };
    state.correctAddends = [...(combo.addendValues || [])];
    state.sum = combo.resultValue;
    state.equation = combo.equation;
    state.status = "SOLVED";

    if (isMaxOutMode()) {
        state.maxOut.currentRoundCorrect += 1;
        state.maxOut.currentRoundScore += 1;
        state.maxOut.currentStreak = activePlayer.currentStreak;
        state.maxOut.bestStreak = Math.max(state.maxOut.bestStreak, activePlayer.bestStreak);
    }

    if (!isFlowMode()) {
        stopSharedTimer();
    }

    saveState(isFlowMode() ? "smartboard-flow-strike" : "smartboard-classic-strike");

    clearFeedbackTimeout();
    feedbackTimeoutId = window.setTimeout(() => {
        feedbackTimeoutId = null;
        clearSelection();

        if (isFlowMode()) {
            generateNextFlowPuzzle();
            return;
        }

        state.status = "COMPLETE";
        state.maxOut.feedback = "PUZZLE_COMPLETE";
        getActivePlayer().roundStatus = stateApi.ROUND_STATUSES.COMPLETE;
        saveState("smartboard-classic-complete");
    }, STRIKE_FEEDBACK_DELAY);
}

function handleMiss(activePlayer) {
    if (!isPracticeMode()) {
        activePlayer.currentStreak = 0;
    }

    if (isPracticeMode()) {
        state.practice.misses += 1;
        state.practice.currentStreak = 0;
    }

    state.maxOut.currentStreak = 0;
    state.maxOut.feedback = "MISS";
    state.maxOut.currentTriple = null;
    state.matchedTargetIndex = null;
    state.status = "TRY_AGAIN";

    saveState(isFlowMode() ? "smartboard-flow-miss" : "smartboard-classic-miss");

    clearFeedbackTimeout();
    feedbackTimeoutId = window.setTimeout(() => {
        feedbackTimeoutId = null;
        clearSelection();

        if (!isFlowMode()) {
            advancePlayer(1);
        }

        state.status = "OPEN";

        if (state.timer.enabled && !isPracticeMode() && !isMaxOutMode()) {
            startSharedTimer();
        }

        saveState(isFlowMode() ? "smartboard-flow-miss-reset" : "smartboard-classic-miss-reset");
    }, MISS_FEEDBACK_DELAY);
}

function syncPuzzleCells() {
    const needed = puzzleExists() ? state.puzzle.length : state.boardSize || 4;

    while (elements.puzzleCells.length < needed) {
        const cell = document.createElement("button");
        cell.className = "puzzle-cell";
        cell.type = "button";
        cell.dataset.index = String(elements.puzzleCells.length);
        cell.addEventListener("click", handlePuzzleClick);
        elements.puzzleCells.push(cell);
        elements.puzzleBoard.append(cell);
    }

    while (elements.puzzleCells.length > needed) {
        const cell = elements.puzzleCells.pop();
        cell.remove();
    }

    elements.puzzleCells.forEach((cell, index) => {
        cell.dataset.index = String(index);
    });
}

function renderGameMode() {
    const labels = {
        CLASSIC: `${state.gridSize || state.settings.gridSize}×${state.gridSize || state.settings.gridSize} Classic`,
        MAX_OUT: "Max Out Challenge",
        PRACTICE: "Practice Mode"
    };

    const instructions = {
        CLASSIC: `Find ${state.settings.requiredAddends} numbers that add to another number`,
        MAX_OUT: "STRIKE loads the next puzzle. MISS keeps the same puzzle.",
        PRACTICE: "Untimed training. Keep hunting and build your streak."
    };

    document.body.classList.toggle("mode-classic", state.gameMode === stateApi.GAME_MODES.CLASSIC);
    document.body.classList.toggle("mode-max-out", isMaxOutMode());
    document.body.classList.toggle("mode-practice", isPracticeMode());

    elements.modeLabel.textContent = labels[state.gameMode] || state.gameMode;
    elements.instructionText.textContent = instructions[state.gameMode] || "Find the hidden equation.";
    document.title = `Operation Hunt: ${labels[state.gameMode]} — Smart Board`;
}

function renderPuzzle() {
    syncPuzzleCells();

    elements.puzzleBoard.classList.remove("grid-size-2", "grid-size-3", "grid-size-4", "grid-size-5");
    elements.puzzleBoard.classList.add(`grid-size-${state.gridSize || state.settings.gridSize || 2}`);
    elements.puzzleBoard.classList.toggle("strike", state.status === "SOLVED");
    elements.puzzleBoard.classList.toggle("wrong", state.status === "TRY_AGAIN");
    elements.puzzleBoard.classList.toggle("time-up", state.status === "TIME_UP");
    elements.puzzleBoard.classList.toggle("complete", state.status === "COMPLETE");

    elements.puzzleCells.forEach((cell, index) => {
        cell.className = "puzzle-cell";
        const value = state.puzzle[index];
        const selected = state.selectedIndexes.includes(index);
        const matched = state.matchedTargetIndex === index;
        const disabled = !isBoardInteractive() || value === undefined;

        cell.textContent = value === undefined ? "" : String(value);
        cell.disabled = disabled;
        cell.setAttribute("aria-pressed", String(selected));

        if (selected) {
            cell.classList.add("selected", "target-locked");
        }

        if (matched) {
            cell.classList.add("correct", "target-matched");
        }

        if (state.status === "REVEALED") {
            renderRevealedCell(cell, index);
        }
    });
}

function renderRevealedCell(cell, index) {
    const combo = state.maxOut.currentTriple || state.completedTriples[0];

    if (!combo) {
        return;
    }

    if ((combo.addendIndexes || []).includes(index)) {
        cell.classList.add("selected", "target-locked");
    }

    if (index === combo.resultIndex) {
        cell.classList.add("correct", "target-matched");
    }
}

function renderScoreboard() {
    elements.scoreboard.replaceChildren();

    if (isPracticeMode()) {
        const rows = [
            ["Mode", "Practice", "∞"],
            ["Streak", String(state.practice.currentStreak || 0), ""],
            ["Best", String(state.practice.bestStreak || 0), ""]
        ];

        rows.forEach(rowValues => {
            const row = document.createElement("div");
            row.className = "player-row active";
            rowValues.forEach(value => {
                const span = document.createElement("span");
                span.textContent = value;
                row.append(span);
            });
            elements.scoreboard.append(row);
        });
        return;
    }

    state.players.forEach((player, index) => {
        const row = document.createElement("div");
        row.className = "player-row";
        const active = index === state.activePlayerIndex && index < state.playerCount;
        const inactive = index >= state.playerCount;

        row.classList.toggle("active", active);
        row.classList.toggle("inactive", inactive);

        [player.name, String(player.score), active ? "▶" : ""].forEach(value => {
            const span = document.createElement("span");
            span.textContent = value;
            row.append(span);
        });

        elements.scoreboard.append(row);
    });
}

function renderActivePlayer() {
    if (elements.activePlayerLabel) {
        elements.activePlayerLabel.textContent = isPracticeMode() ? "TRAINING MODE" : "ACTIVE PLAYER";
    }

    elements.activePlayerName.textContent = isPracticeMode()
        ? "Practice Mode"
        : getActivePlayer()?.name || "Player 1";
}

function renderEquation() {
    const runningSumEnabled = Boolean(state.settings.showRunningSum);

    if (state.status === "SOLVED" || state.status === "COMPLETE" || state.status === "REVEALED") {
        elements.equationDisplay.textContent = state.equation || "TARGET MATCHED";
        return;
    }

    if (state.status === "TRY_AGAIN") {
        elements.equationDisplay.textContent = runningSumEnabled && state.equation
            ? state.equation
            : "MISS — TRY AGAIN";
        return;
    }

    elements.equationDisplay.textContent = buildEquationFromSelection({
        showRunningSum: runningSumEnabled
    });
}

function renderStatus() {
    const statusText = {
        WAITING: "WAITING FOR PUZZLE",
        OPEN: state.selectedIndexes.length > 0 ? "TARGET LOCKED" : "ROUND OPEN",
        SOLVED: "STRIKE",
        COMPLETE: "PUZZLE COMPLETE",
        REVEALED: "ANSWER REVEALED",
        TRY_AGAIN: "MISS",
        TIME_UP: "TIME UP"
    };

    elements.sessionStatus.textContent = statusText[state.status] || state.status;
    elements.statusCard.classList.toggle("time-up", state.status === "TIME_UP");
    elements.statusCard.classList.toggle("strike", state.status === "SOLVED");
    elements.statusCard.classList.toggle("complete", state.status === "COMPLETE");
}

function renderSummary() {
    elements.totalPuzzles.textContent = String(state.totalPuzzles);
    elements.totalAttempts.textContent = String(state.totalAttempts);
    elements.totalCorrect.textContent = String(state.totalCorrect);
    elements.classAccuracy.textContent = state.totalAttempts === 0
        ? "—"
        : `${((state.totalCorrect / state.totalAttempts) * 100).toFixed(2)}%`;
}

function renderTimer() {
    const duration = Math.max(1, Number(state.timer.duration) || 30);
    const remaining = getLiveTimerRemaining();
    const degrees = Math.max(0, Math.min(360, (remaining / duration) * 360));

    elements.timerDisplay.textContent = formatTimer(remaining);
    elements.timerRing.style.setProperty("--timer-progress", `${degrees}deg`);
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
    } else if (["SOLVED", "COMPLETE", "REVEALED"].includes(state.status)) {
        elements.timerCaption.textContent = "TIMER STOPPED";
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
    state.maxOut.feedback = "TIME_UP";
    saveState("smartboard-time-up");
}

function render() {
    renderGameMode();
    renderPuzzle();
    renderScoreboard();
    renderActivePlayer();
    renderEquation();
    renderStatus();
    renderSummary();
    renderTimer();
}

function connectEvents() {
    elements.puzzleCells.forEach(cell => {
        cell.addEventListener("click", handlePuzzleClick);
    });

    stateApi.subscribe(() => {
        render();
    });

    timerVisualIntervalId = window.setInterval(() => {
        monitorTimer();

        if (state.timer.running) {
            renderTimer();
        }
    }, 200);

    window.addEventListener("beforeunload", () => {
        clearFeedbackTimeout();

        if (timerVisualIntervalId !== null) {
            window.clearInterval(timerVisualIntervalId);
        }
    });
}

connectEvents();
render();
