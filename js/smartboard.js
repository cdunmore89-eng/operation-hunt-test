"use strict";

const stateApi = window.OperationHuntState;
const puzzleEngine = window.OperationHuntPuzzleEngine;
const algebraEngine = window.OperationHuntAlgebraEngine;

if (!stateApi) {
    throw new Error("OperationHuntState did not load.");
}

if (!puzzleEngine) {
    throw new Error("OperationHuntPuzzleEngine did not load.");
}

if (!algebraEngine) {
    throw new Error("OperationHuntAlgebraEngine did not load.");
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
    algebraBanner: document.querySelector("#algebra-banner"),
    algebraBannerKicker: document.querySelector("#algebra-banner-kicker"),
    algebraBannerText: document.querySelector("#algebra-banner-text"),
    algebraBannerDetail: document.querySelector("#algebra-banner-detail"),
    modeLabel: document.querySelector(".brand-mode"),
    instructionText: document.querySelector(".smartboard-instruction-panel p"),
    activePlayerLabel: document.querySelector(".smartboard-active-card span")
};

let feedbackTimeoutId = null;
let timerVisualIntervalId = null;
let boardSwapTimeoutId = null;
let lastRenderedPuzzleKey = "";

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

function isAlgebraMode() {
    return state.settings.content === "algebra";
}

function getRequiredSelections() {
    if (isAlgebraMode() && state.algebraRound) {
        return algebraEngine.getSelectionCount(state.algebraRound);
    }

    return Number(state.settings.requiredAddends) || 2;
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

function getOperation() {
    if (puzzleEngine && typeof puzzleEngine.normalizeOperation === "function") {
        return puzzleEngine.normalizeOperation(state.settings.operation);
    }

    return state.settings.operation || "addition";
}

function getOperationMeta() {
    if (puzzleEngine && typeof puzzleEngine.getOperation === "function") {
        return puzzleEngine.getOperation(getOperation());
    }

    return { id: "addition", label: "Addition", symbol: "+" };
}

function getOperationSymbol() {
    return getOperationMeta().symbol;
}

function getOperationLabel() {
    return getOperationMeta().label;
}

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

function getSelectedValues() {
    return state.selectedIndexes.map(index => state.puzzle[index]);
}

// Left-folds the selected values, in click order, with the current
// operation. Returns null for an inexact division fold.
function getSelectedResult() {
    const selectedValues = getSelectedValues();

    if (selectedValues.length === 0) {
        return 0;
    }

    if (puzzleEngine && typeof puzzleEngine.computeResult === "function") {
        return puzzleEngine.computeResult(
            selectedValues.map(value => Number(value || 0)),
            getOperation()
        );
    }

    return selectedValues.reduce((total, value) => total + Number(value || 0), 0);
}

// Historical name; now operation-aware via getSelectedResult().
function getSelectedSum() {
    return getSelectedResult();
}

function buildEquationFromSelection(options = {}) {
    const { showRunningSum = false, forceResult = false } = options;
    const selectedValues = getSelectedValues();
    const requiredAddends = Number(state.settings.requiredAddends) || 2;
    const emptySlots = Array.from(
        { length: Math.max(0, requiredAddends - selectedValues.length) },
        () => "?"
    );
    const leftSide = [...selectedValues, ...emptySlots].join(` ${getOperationSymbol()} `);
    const shouldShowResult = forceResult || (showRunningSum && selectedValues.length > 0);
    const computedResult = shouldShowResult ? getSelectedResult() : null;
    const result = shouldShowResult
        ? (computedResult === null ? "?" : computedResult)
        : "?";

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
            requiredAddends: state.settings.requiredAddends,
            operation: getOperation(),
            allowNegatives: Boolean(state.settings.allowNegatives)
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

    if (state.selectedIndexes.length >= getRequiredSelections()) {
        return;
    }

    state.selectedIndexes.push(index);
    state.maxOut.feedback = "TARGET_LOCKED";

    if (state.selectedIndexes.length === getRequiredSelections()) {
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

    if (isAlgebraMode() && state.algebraRound) {
        checkAlgebraAnswer(activePlayer);
        return;
    }

    cacheAttemptEquation();

    if (isPracticeMode()) {
        state.practice.puzzlesAttempted += 1;
    }

    const combo = typeof puzzleEngine.findComboForOperation === "function"
        ? puzzleEngine.findComboForOperation(
            state.puzzle,
            state.selectedIndexes,
            state.settings.requiredAddends,
            [],
            getOperation()
        )
        : puzzleEngine.findComboForSelection(
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

function checkAlgebraAnswer(activePlayer) {
    const result = algebraEngine.checkAlgebraSelection(
        state.algebraRound,
        state.selectedIndexes
    );

    if (!result.correct) {
        state.equation = result.display || "MISS — TRY AGAIN";
        handleMiss(activePlayer);
        return;
    }

    awardCorrect(activePlayer);

    state.matchedTargetIndex = result.resultIndex !== null && result.resultIndex !== undefined
        ? result.resultIndex
        : null;
    state.completedTriples = [];
    state.maxOut.currentTriple = null;
    state.maxOut.feedback = "STRIKE";
    state.maxOut.equationValues = { first: null, second: null, result: null };
    state.correctAddends = [];
    state.sum = null;
    state.equation = result.display || "TARGET STRIKE";
    state.status = "SOLVED";

    stopSharedTimer();
    saveState("smartboard-algebra-strike");
    render();

    clearFeedbackTimeout();
    feedbackTimeoutId = window.setTimeout(() => {
        feedbackTimeoutId = null;
        clearSelection();
        state.status = "COMPLETE";
        state.maxOut.feedback = "PUZZLE_COMPLETE";
        getActivePlayer().roundStatus = stateApi.ROUND_STATUSES.COMPLETE;
        saveState("smartboard-algebra-complete");
        render();
    }, STRIKE_FEEDBACK_DELAY);
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
        CLASSIC: `Find ${state.settings.requiredAddends} numbers that ${getOperationVerbPhrase()} another number`,
        MAX_OUT: "STRIKE loads the next puzzle. MISS keeps the same puzzle.",
        PRACTICE: "Untimed training. Keep hunting and build your streak."
    };

    document.body.classList.toggle("mode-classic", state.gameMode === stateApi.GAME_MODES.CLASSIC);
    document.body.classList.toggle("mode-max-out", isMaxOutMode());
    document.body.classList.toggle("mode-practice", isPracticeMode());

    if (isAlgebraMode()) {
        const round = state.algebraRound;
        elements.modeLabel.textContent = `Algebra · ${algebraEngine.getSkillLabel(round?.skill || state.settings.algebraSkill)}`;
        elements.instructionText.textContent = round
            ? algebraEngine.getSkillDescription(round.skill)
            : "Find the algebra target.";
        document.title = "Operation Hunt: Algebra — Smart Board";
        return;
    }

    elements.modeLabel.textContent = `${labels[state.gameMode] || state.gameMode} · ${getOperationLabel()}`;
    elements.instructionText.textContent = instructions[state.gameMode] || "Find the hidden equation.";
    document.title = `Operation Hunt: ${labels[state.gameMode]} — Smart Board`;
}

function flagBoardSwap() {
    elements.puzzleBoard.classList.add("board-swap");

    if (boardSwapTimeoutId !== null) {
        window.clearTimeout(boardSwapTimeoutId);
    }

    boardSwapTimeoutId = window.setTimeout(() => {
        boardSwapTimeoutId = null;
        elements.puzzleBoard.classList.remove("board-swap");
    }, 400);
}

function renderAlgebraBanner() {
    if (!elements.algebraBanner) {
        return;
    }

    const round = isAlgebraMode() ? state.algebraRound : null;
    elements.algebraBanner.hidden = !round;

    if (!round) {
        return;
    }

    elements.algebraBannerKicker.textContent =
        `${algebraEngine.getSkillLabel(round.skill)} · ${algebraEngine.GRADE_BANDS[round.gradeBand] || round.gradeBand}`;
    elements.algebraBannerText.textContent =
        round.skill === "missing-number" &&
        ["SOLVED", "COMPLETE", "REVEALED"].includes(state.status) &&
        round.solution?.faceEquation
            ? round.solution.faceEquation
            : round.banner.text;
    elements.algebraBannerDetail.textContent = round.banner.detail || "";
}

function renderPuzzle() {
    syncPuzzleCells();

    // A different board landing while a round is open (a
    // teacher's New Puzzle, a flow-mode next puzzle, or a
    // seamless settings change that had to re-deal) gets a
    // brief fade so the new tiles land smoothly. Selection,
    // strike and miss renders keep the same puzzle key and
    // never trigger it. Purely visual.
    const puzzleKey = isAlgebraMode() && state.algebraRound
        ? state.algebraRound.tiles.map(tile => tile.face).join(",")
        : state.puzzle.join(",");

    if (
        lastRenderedPuzzleKey &&
        puzzleKey &&
        puzzleKey !== lastRenderedPuzzleKey &&
        state.status === "OPEN"
    ) {
        flagBoardSwap();
    }

    lastRenderedPuzzleKey = puzzleKey;

    elements.puzzleBoard.classList.remove("grid-size-2", "grid-size-3", "grid-size-4", "grid-size-5");
    elements.puzzleBoard.classList.add(`grid-size-${state.gridSize || state.settings.gridSize || 2}`);
    elements.puzzleBoard.classList.toggle("strike", state.status === "SOLVED");
    elements.puzzleBoard.classList.toggle("wrong", state.status === "TRY_AGAIN");
    elements.puzzleBoard.classList.toggle("time-up", state.status === "TIME_UP");
    elements.puzzleBoard.classList.toggle("complete", state.status === "COMPLETE");

    elements.puzzleCells.forEach((cell, index) => {
        cell.className = "puzzle-cell";
        const value = state.puzzle[index];
        const algebraTile = isAlgebraMode() ? state.algebraRound?.tiles?.[index] || null : null;
        const selected = state.selectedIndexes.includes(index);
        const matched = state.matchedTargetIndex === index;
        const disabled = !isBoardInteractive() || (algebraTile ? false : value === undefined);

        cell.textContent = algebraTile ? algebraTile.face : value === undefined ? "" : String(value);
        cell.disabled = disabled;
        cell.setAttribute("aria-pressed", String(selected));

        if (algebraTile) {
            cell.classList.add(
                "algebra-tile",
                `face-tier-${algebraTile.faceTier ?? algebraEngine.getFaceTier(algebraTile.face)}`
            );
            cell.setAttribute("aria-label", `Puzzle tile ${algebraTile.face}`);

            if (
                selected &&
                state.algebraRound?.skill === "equivalent" &&
                ["SOLVED", "COMPLETE", "REVEALED"].includes(state.status)
            ) {
                cell.classList.add("correct", "target-matched");
            }
        }

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

    state.players.slice(0, state.playerCount).forEach((player, index) => {
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
    if (isAlgebraMode() && state.algebraRound) {
        const round = state.algebraRound;

        if (state.status === "SOLVED" || state.status === "COMPLETE" || state.status === "REVEALED") {
            elements.equationDisplay.textContent = state.equation || "TARGET STRIKE";
            return;
        }

        if (state.status === "TRY_AGAIN") {
            elements.equationDisplay.textContent = state.equation || "MISS — TRY AGAIN";
            return;
        }

        if (state.selectedIndexes.length > 0) {
            const faces = state.selectedIndexes.map(index => round.tiles[index]?.face ?? "?");

            elements.equationDisplay.textContent = round.skill === "equivalent"
                ? faces.join("  ≟  ")
                : round.skill === "evaluate"
                    ? `${faces.join(` ${getOperationSymbol()} `)} = ?`
                    : faces.join(" ");
            return;
        }

        elements.equationDisplay.textContent = algebraEngine.getSkillDescription(round.skill);
        return;
    }

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
    renderAlgebraBanner();
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
