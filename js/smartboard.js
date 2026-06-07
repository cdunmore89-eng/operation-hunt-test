"use strict";

const stateApi = window.OperationHuntState;
const state = stateApi.getState();

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
    timerCaption: document.querySelector("#timer-caption")
};

let timerVisualInterval = null;

function handlePuzzleClick(event) {
    const clickedIndex = Number.parseInt(
        event.currentTarget.dataset.index,
        10
    );

    if (
        state.status !== "OPEN" ||
        state.puzzle.length !== 4
    ) {
        return;
    }

    if (state.selectedIndexes.includes(clickedIndex)) {
        state.selectedIndexes =
            state.selectedIndexes.filter(
                index => index !== clickedIndex
            );

        stateApi.saveState({
            reason: "selection-removed"
        });

        return;
    }

    state.selectedIndexes.push(clickedIndex);

    if (state.selectedIndexes.length === 1) {
        stateApi.saveState({
            reason: "first-selection"
        });

        return;
    }

    checkStudentAnswer();
}

function checkStudentAnswer() {
    const selectedValues =
        state.selectedIndexes
            .map(index => state.puzzle[index])
            .sort((a, b) => a - b);

    const correctAddends =
        [...state.correctAddends]
            .sort((a, b) => a - b);

    const isCorrect =
        selectedValues[0] === correctAddends[0] &&
        selectedValues[1] === correctAddends[1];

    const activePlayer =
        state.players[state.activePlayerIndex];

    activePlayer.attempts += 1;
    state.totalAttempts += 1;

    if (isCorrect) {
        activePlayer.correct += 1;
        activePlayer.score += 1;
        state.totalCorrect += 1;

        state.status = "SOLVED";
        state.selectedIndexes = [];

        stopSharedTimer();

        stateApi.saveState({
            reason: "correct-answer"
        });

        return;
    }

    state.status = "TRY_AGAIN";

    stateApi.saveState({
        reason: "wrong-answer"
    });

    window.setTimeout(() => {
        state.selectedIndexes = [];
        state.status = "OPEN";

        advancePlayer(1);

        if (state.timer.enabled) {
            startSharedTimer();
        }

        stateApi.saveState({
            reason: "wrong-answer-reset"
        });
    }, 450);
}

function advancePlayer(direction) {
    state.activePlayerIndex =
        (
            state.activePlayerIndex +
            direction +
            state.playerCount
        ) % state.playerCount;
}

function startSharedTimer() {
    if (
        !state.timer.enabled ||
        state.status !== "OPEN" ||
        state.puzzle.length !== 4
    ) {
        return;
    }

    state.timer.running = true;
    state.timer.remaining = state.timer.duration;
    state.timer.endTime =
        Date.now() +
        state.timer.duration * 1000;
}

function stopSharedTimer() {
    state.timer.running = false;
    state.timer.endTime = null;
}

function getLiveTimerRemaining() {
    if (
        !state.timer.running ||
        !state.timer.endTime
    ) {
        return Math.max(
            0,
            Number(state.timer.remaining) || 0
        );
    }

    return Math.max(
        0,
        Math.ceil(
            (state.timer.endTime - Date.now()) / 1000
        )
    );
}

function formatTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}

function render() {
    renderPuzzle();
    renderScoreboard();
    renderActivePlayer();
    renderEquation();
    renderStatus();
    renderSummary();
    renderTimer();
}

function renderPuzzle() {
    elements.puzzleBoard.classList.toggle(
        "wrong",
        state.status === "TRY_AGAIN"
    );

    elements.puzzleBoard.classList.toggle(
        "time-up",
        state.status === "TIME_UP"
    );

    elements.puzzleCells.forEach((cell, index) => {
        cell.className = "puzzle-cell";

        const value = state.puzzle[index];

        cell.textContent =
            value === undefined ? "" : String(value);

        cell.disabled =
            state.status === "TIME_UP";

        if (state.selectedIndexes.includes(index)) {
            cell.classList.add("selected");
        }

        if (
            state.status === "SOLVED" ||
            state.status === "REVEALED"
        ) {
            const number = state.puzzle[index];

            const isCorrectNumber =
                state.correctAddends.includes(number) ||
                number === state.sum;

            if (isCorrectNumber) {
                cell.classList.add("correct");
            }
        }
    });
}

function renderScoreboard() {
    elements.scoreboard.innerHTML = "";

    state.players.forEach((player, index) => {
        const row = document.createElement("div");
        row.className = "player-row";

        const isActive =
            index === state.activePlayerIndex &&
            index < state.playerCount;

        const isInactive =
            index >= state.playerCount;

        if (isActive) {
            row.classList.add("active");
        }

        if (isInactive) {
            row.classList.add("inactive");
        }

        const name = document.createElement("span");
        name.textContent = player.name;

        const score = document.createElement("span");
        score.textContent = String(player.score);

        const turn = document.createElement("span");
        turn.textContent = isActive ? "▶" : "";

        row.append(name, score, turn);
        elements.scoreboard.append(row);
    });
}

function renderActivePlayer() {
    const activePlayer =
        state.players[state.activePlayerIndex];

    elements.activePlayerName.textContent =
        activePlayer?.name || "Player 1";
}

function renderEquation() {
    if (
        state.status === "SOLVED" ||
        state.status === "REVEALED"
    ) {
        elements.equationDisplay.textContent =
            state.equation;

        return;
    }

    if (state.status === "TRY_AGAIN") {
        elements.equationDisplay.textContent =
            "Try Again";

        return;
    }

    elements.equationDisplay.textContent =
        "Hidden";
}

function renderStatus() {
    const statusText = {
        WAITING: "WAITING FOR PUZZLE",
        OPEN: "ROUND OPEN",
        SOLVED: "SOLVED",
        REVEALED: "ANSWER REVEALED",
        TRY_AGAIN: "TRY AGAIN",
        TIME_UP: "TIME UP"
    };

    elements.sessionStatus.textContent =
        statusText[state.status] || state.status;

    elements.statusCard.classList.toggle(
        "time-up",
        state.status === "TIME_UP"
    );
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

function renderTimer() {
    const duration =
        Math.max(1, Number(state.timer.duration) || 30);

    const remaining =
        getLiveTimerRemaining();

    const progress =
        remaining / duration;

    const degrees =
        Math.max(
            0,
            Math.min(
                360,
                progress * 360
            )
        );

    elements.timerDisplay.textContent =
        formatTimer(remaining);

    elements.timerRing.style.setProperty(
        "--timer-progress",
        `${degrees}deg`
    );

    elements.timerToggleLabel.textContent =
        state.timer.enabled ? "ON" : "OFF";

    elements.timerCard.classList.toggle(
        "timer-disabled",
        !state.timer.enabled
    );

    elements.timerCard.classList.toggle(
        "time-up",
        state.status === "TIME_UP"
    );

    if (state.status === "TIME_UP") {
        elements.timerCaption.textContent =
            "TIME EXPIRED";

        return;
    }

    if (!state.timer.enabled) {
        elements.timerCaption.textContent =
            "TIMER OFF";

        return;
    }

    if (state.timer.running) {
        elements.timerCaption.textContent =
            "TIME REMAINING";

        return;
    }

    if (
        state.status === "SOLVED" ||
        state.status === "REVEALED"
    ) {
        elements.timerCaption.textContent =
            "TIMER STOPPED";

        return;
    }

    elements.timerCaption.textContent =
        "READY";
}

function connectEvents() {
    elements.puzzleCells.forEach(cell => {
        cell.addEventListener(
            "click",
            handlePuzzleClick
        );
    });

    stateApi.subscribe(() => {
        render();
    });

    timerVisualInterval =
        window.setInterval(() => {
            if (state.timer.running) {
                renderTimer();
            }
        }, 200);
}

function startSmartBoard() {
    connectEvents();
    render();
}

startSmartBoard();