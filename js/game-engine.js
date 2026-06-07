"use strict";

const MAX_PLAYERS = 6;

const state = {
    puzzle: [],
    correctAddends: [],
    sum: null,
    equation: "",
    selectedIndexes: [],

    status: "WAITING",

    playerCount: 2,
    activePlayerIndex: 0,

    players: createDefaultPlayers(),

    totalPuzzles: 0,
    totalAttempts: 0,
    totalCorrect: 0,

    timer: {
        enabled: false,
        duration: 30,
        remaining: 30,
        running: false,
        intervalId: null,
        endTime: null
    }
};

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

    playerCount: document.querySelector("#player-count"),
    minimumNumber: document.querySelector("#minimum-number"),
    maximumNumber: document.querySelector("#maximum-number"),

    newPuzzleButton: document.querySelector("#new-puzzle-button"),
    revealButton: document.querySelector("#reveal-button"),
    previousPlayerButton: document.querySelector("#previous-player-button"),
    nextPlayerButton: document.querySelector("#next-player-button"),
    resetSessionButton: document.querySelector("#reset-session-button"),
    resetBoardButton: document.querySelector("#reset-board-button"),

    timerCard: document.querySelector("#timer-card"),
    timerToggle: document.querySelector("#timer-toggle"),
    timerToggleLabel: document.querySelector("#timer-toggle-label"),
    timerDuration: document.querySelector("#timer-duration"),
    timerRing: document.querySelector("#timer-ring"),
    timerDisplay: document.querySelector("#timer-display"),
    timerCaption: document.querySelector("#timer-caption")
};

function createDefaultPlayers() {
    return Array.from(
        { length: MAX_PLAYERS },
        (_, index) => ({
            name: `Player ${index + 1}`,
            score: 0,
            attempts: 0,
            correct: 0
        })
    );
}

/*
====================================================
PUZZLE GENERATION
====================================================
*/

function randomInteger(minimum, maximum) {
    return Math.floor(
        Math.random() * (maximum - minimum + 1)
    ) + minimum;
}

function shuffle(values) {
    const shuffled = [...values];

    for (
        let index = shuffled.length - 1;
        index > 0;
        index -= 1
    ) {
        const randomIndex = Math.floor(
            Math.random() * (index + 1)
        );

        [
            shuffled[index],
            shuffled[randomIndex]
        ] = [
                shuffled[randomIndex],
                shuffled[index]
            ];
    }

    return shuffled;
}

function findAdditionTriples(numbers) {
    const triples = [];

    for (
        let first = 0;
        first < numbers.length;
        first += 1
    ) {
        for (
            let second = first + 1;
            second < numbers.length;
            second += 1
        ) {
            const possibleSum =
                numbers[first] + numbers[second];

            for (
                let result = 0;
                result < numbers.length;
                result += 1
            ) {
                if (
                    result !== first &&
                    result !== second &&
                    numbers[result] === possibleSum
                ) {
                    const addends = [
                        numbers[first],
                        numbers[second]
                    ].sort((a, b) => a - b);

                    triples.push({
                        addend1: addends[0],
                        addend2: addends[1],
                        sum: numbers[result]
                    });
                }
            }
        }
    }

    return triples;
}

function createPuzzle(minimum, maximum) {
    for (
        let attempt = 0;
        attempt < 10000;
        attempt += 1
    ) {
        const firstAddend =
            randomInteger(minimum, maximum);

        const secondAddend =
            randomInteger(minimum, maximum);

        const sum =
            firstAddend + secondAddend;

        if (sum > maximum) {
            continue;
        }

        const distractor =
            randomInteger(minimum, maximum);

        const numbers = [
            firstAddend,
            secondAddend,
            sum,
            distractor
        ];

        if (new Set(numbers).size !== 4) {
            continue;
        }

        const validTriples =
            findAdditionTriples(numbers);

        if (validTriples.length !== 1) {
            continue;
        }

        const solution =
            validTriples[0];

        return {
            numbers: shuffle(numbers),

            addends: [
                solution.addend1,
                solution.addend2
            ].sort((a, b) => a - b),

            sum: solution.sum,

            equation:
                `${solution.addend1} + ` +
                `${solution.addend2} = ` +
                `${solution.sum}`
        };
    }

    throw new Error(
        "A valid puzzle could not be generated. Increase the maximum number."
    );
}

function generatePuzzle() {
    const minimum =
        Number.parseInt(
            elements.minimumNumber.value,
            10
        );

    const maximum =
        Number.parseInt(
            elements.maximumNumber.value,
            10
        );

    if (
        !Number.isInteger(minimum) ||
        !Number.isInteger(maximum) ||
        minimum < 1 ||
        maximum <= minimum
    ) {
        window.alert(
            "Minimum and maximum must be whole numbers. Maximum must be greater than minimum."
        );

        return;
    }

    stopTimer();

    if (state.puzzle.length > 0) {
        advancePlayer(1);
    }

    try {
        const puzzle =
            createPuzzle(minimum, maximum);

        state.puzzle =
            puzzle.numbers;

        state.correctAddends =
            puzzle.addends;

        state.sum =
            puzzle.sum;

        state.equation =
            puzzle.equation;

        state.selectedIndexes = [];
        state.status = "OPEN";
        state.totalPuzzles += 1;

        clearTimeoutAppearance();
        render();

        if (state.timer.enabled) {
            startTimer();
        }
    } catch (error) {
        window.alert(error.message);
    }
}

/*
====================================================
STUDENT INPUT
====================================================
*/

function handlePuzzleClick(event) {
    const clickedCell =
        event.currentTarget;

    const clickedIndex =
        Number.parseInt(
            clickedCell.dataset.index,
            10
        );

    if (
        state.status !== "OPEN" ||
        state.puzzle.length !== 4
    ) {
        return;
    }

    /*
    Click the selected number again to remove it.
    */
    if (
        state.selectedIndexes.includes(clickedIndex)
    ) {
        state.selectedIndexes =
            state.selectedIndexes.filter(
                index => index !== clickedIndex
            );

        renderPuzzle();
        return;
    }

    state.selectedIndexes.push(clickedIndex);

    if (state.selectedIndexes.length === 1) {
        renderPuzzle();
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

        stopTimer();
        render();
        return;
    }

    showWrongAnswer();
}

function showWrongAnswer() {
    stopTimer();

    state.status = "TRY_AGAIN";

    elements.puzzleBoard.classList.add("wrong");

    renderStatus();
    renderEquation();
    renderSummary();

    window.setTimeout(() => {
        elements.puzzleBoard.classList.remove("wrong");

        state.selectedIndexes = [];
        state.status = "OPEN";

        advancePlayer(1);
        render();

        if (state.timer.enabled) {
            startTimer();
        }
    }, 450);
}

/*
====================================================
TIMER
====================================================
*/

function setTimerEnabled() {
    state.timer.enabled =
        elements.timerToggle.checked;

    stopTimer();

    state.timer.remaining =
        state.timer.duration;

    clearTimeoutAppearance();

    if (
        state.timer.enabled &&
        state.status === "OPEN" &&
        state.puzzle.length === 4
    ) {
        startTimer();
    }

    renderTimer();
}

function setTimerDuration() {
    const duration =
        Number.parseInt(
            elements.timerDuration.value,
            10
        );

    if (!Number.isInteger(duration)) {
        return;
    }

    state.timer.duration = duration;
    state.timer.remaining = duration;

    stopTimer();
    clearTimeoutAppearance();

    if (
        state.timer.enabled &&
        state.status === "OPEN" &&
        state.puzzle.length === 4
    ) {
        startTimer();
    }

    renderTimer();
}

function startTimer() {
    stopTimer();
    clearTimeoutAppearance();

    if (
        !state.timer.enabled ||
        state.status !== "OPEN" ||
        state.puzzle.length !== 4
    ) {
        renderTimer();
        return;
    }

    state.timer.remaining =
        state.timer.duration;

    state.timer.running = true;

    state.timer.endTime =
        Date.now() +
        state.timer.duration * 1000;

    updateTimerFromClock();

    state.timer.intervalId =
        window.setInterval(
            updateTimerFromClock,
            200
        );
}

function stopTimer() {
    if (state.timer.intervalId !== null) {
        window.clearInterval(
            state.timer.intervalId
        );
    }

    state.timer.intervalId = null;
    state.timer.running = false;
    state.timer.endTime = null;
}

function updateTimerFromClock() {
    if (
        !state.timer.running ||
        state.timer.endTime === null
    ) {
        return;
    }

    const millisecondsRemaining =
        state.timer.endTime - Date.now();

    const secondsRemaining =
        Math.max(
            0,
            Math.ceil(
                millisecondsRemaining / 1000
            )
        );

    state.timer.remaining =
        secondsRemaining;

    renderTimer();

    if (millisecondsRemaining <= 0) {
        handleTimeUp();
    }
}

function handleTimeUp() {
    stopTimer();

    state.timer.remaining = 0;
    state.selectedIndexes = [];
    state.status = "TIME_UP";

    elements.puzzleBoard.classList.add(
        "time-up",
        "timeout-buzz"
    );

    elements.timerCard.classList.add(
        "time-up"
    );

    elements.statusCard.classList.add(
        "time-up"
    );

    render();

    window.setTimeout(() => {
        elements.puzzleBoard.classList.remove(
            "timeout-buzz"
        );
    }, 800);
}

function clearTimeoutAppearance() {
    elements.puzzleBoard.classList.remove(
        "time-up",
        "timeout-buzz"
    );

    elements.timerCard.classList.remove(
        "time-up"
    );

    elements.statusCard.classList.remove(
        "time-up"
    );
}

function resetTimerToDuration() {
    stopTimer();

    state.timer.remaining =
        state.timer.duration;

    clearTimeoutAppearance();
    renderTimer();
}

function formatTimer(seconds) {
    const minutes =
        Math.floor(seconds / 60);

    const remainingSeconds =
        seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}

/*
====================================================
TEACHER CONTROLS
====================================================
*/

function revealAnswer() {
    if (state.puzzle.length !== 4) {
        window.alert(
            "Generate a puzzle first."
        );

        return;
    }

    stopTimer();
    clearTimeoutAppearance();

    state.selectedIndexes = [];
    state.status = "REVEALED";

    render();
}

function advancePlayer(direction) {
    const playerCount =
        state.playerCount;

    state.activePlayerIndex =
        (
            state.activePlayerIndex +
            direction +
            playerCount
        ) % playerCount;
}

function nextPlayer() {
    state.selectedIndexes = [];

    advancePlayer(1);

    if (
        state.puzzle.length === 4 &&
        (
            state.status === "OPEN" ||
            state.status === "TIME_UP" ||
            state.status === "TRY_AGAIN"
        )
    ) {
        state.status = "OPEN";
        clearTimeoutAppearance();
        render();

        if (state.timer.enabled) {
            startTimer();
        }

        return;
    }

    render();
}

function previousPlayer() {
    state.selectedIndexes = [];

    advancePlayer(-1);

    if (
        state.puzzle.length === 4 &&
        (
            state.status === "OPEN" ||
            state.status === "TIME_UP" ||
            state.status === "TRY_AGAIN"
        )
    ) {
        state.status = "OPEN";
        clearTimeoutAppearance();
        render();

        if (state.timer.enabled) {
            startTimer();
        }

        return;
    }

    render();
}

function resetBoard() {
    stopTimer();

    state.puzzle = [];
    state.correctAddends = [];
    state.sum = null;
    state.equation = "";
    state.selectedIndexes = [];
    state.status = "WAITING";

    resetTimerToDuration();
    clearTimeoutAppearance();

    render();
}

function resetSession() {
    const confirmed =
        window.confirm(
            "Reset all scores and session data?"
        );

    if (!confirmed) {
        return;
    }

    stopTimer();

    state.players.forEach(player => {
        player.score = 0;
        player.attempts = 0;
        player.correct = 0;
    });

    state.totalPuzzles = 0;
    state.totalAttempts = 0;
    state.totalCorrect = 0;
    state.activePlayerIndex = 0;

    state.puzzle = [];
    state.correctAddends = [];
    state.sum = null;
    state.equation = "";
    state.selectedIndexes = [];
    state.status = "WAITING";

    resetTimerToDuration();
    clearTimeoutAppearance();

    render();
}

/*
====================================================
SETTINGS
====================================================
*/

function updatePlayerCount() {
    state.playerCount =
        Number.parseInt(
            elements.playerCount.value,
            10
        );

    if (
        state.activePlayerIndex >=
        state.playerCount
    ) {
        state.activePlayerIndex = 0;
    }

    render();
}

function updatePlayerName(index, name) {
    const trimmedName =
        name.trim();

    state.players[index].name =
        trimmedName ||
        `Player ${index + 1}`;

    renderActivePlayer();
}

/*
====================================================
RENDERING
====================================================
*/

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
    elements.puzzleCells.forEach(
        (cell, index) => {
            cell.className =
                "puzzle-cell";

            const value =
                state.puzzle[index];

            cell.textContent =
                value === undefined
                    ? ""
                    : String(value);

            cell.disabled =
                state.status === "TIME_UP";

            if (
                state.selectedIndexes.includes(index)
            ) {
                cell.classList.add("selected");
            }

            if (
                state.status === "SOLVED" ||
                state.status === "REVEALED"
            ) {
                const number =
                    state.puzzle[index];

                const isCorrectNumber =
                    state.correctAddends.includes(number) ||
                    number === state.sum;

                if (isCorrectNumber) {
                    cell.classList.add("correct");
                }
            }
        }
    );
}

function renderScoreboard() {
    elements.scoreboard.innerHTML = "";

    state.players.forEach(
        (player, index) => {
            const row =
                document.createElement("div");

            row.className =
                "player-row";

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

            const nameInput =
                document.createElement("input");

            nameInput.className =
                "player-name-input";

            nameInput.value =
                player.name;

            nameInput.disabled =
                isInactive;

            nameInput.addEventListener(
                "change",
                event => {
                    updatePlayerName(
                        index,
                        event.target.value
                    );
                }
            );

            const score =
                document.createElement("span");

            score.textContent =
                String(player.score);

            const turn =
                document.createElement("span");

            turn.textContent =
                isActive ? "▶" : "";

            row.append(
                nameInput,
                score,
                turn
            );

            elements.scoreboard.append(row);
        }
    );
}

function renderActivePlayer() {
    const activePlayer =
        state.players[
        state.activePlayerIndex
        ];

    elements.activePlayerName.textContent =
        activePlayer.name;
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
        statusText[state.status] ||
        state.status;

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
        state.timer.duration;

    const remaining =
        Math.max(
            0,
            state.timer.remaining
        );

    const progress =
        duration > 0
            ? remaining / duration
            : 0;

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

/*
====================================================
EVENTS
====================================================
*/

function connectEvents() {
    elements.puzzleCells.forEach(cell => {
        cell.addEventListener(
            "click",
            handlePuzzleClick
        );
    });

    elements.newPuzzleButton.addEventListener(
        "click",
        generatePuzzle
    );

    elements.revealButton.addEventListener(
        "click",
        revealAnswer
    );

    elements.previousPlayerButton.addEventListener(
        "click",
        previousPlayer
    );

    elements.nextPlayerButton.addEventListener(
        "click",
        nextPlayer
    );

    elements.resetSessionButton.addEventListener(
        "click",
        resetSession
    );

    elements.resetBoardButton.addEventListener(
        "click",
        resetBoard
    );

    elements.playerCount.addEventListener(
        "change",
        updatePlayerCount
    );

    elements.timerToggle.addEventListener(
        "change",
        setTimerEnabled
    );

    elements.timerDuration.addEventListener(
        "change",
        setTimerDuration
    );
}

/*
====================================================
START
====================================================
*/

function startGame() {
    state.timer.duration =
        Number.parseInt(
            elements.timerDuration.value,
            10
        );

    state.timer.remaining =
        state.timer.duration;

    connectEvents();
    render();
}

startGame();