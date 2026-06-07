"use strict";

const stateApi = window.OperationHuntState;
const state = stateApi.getState();
const PLAYER_LIMIT = stateApi.MAX_PLAYERS;

const elements = {
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

    currentPuzzleDisplay: document.querySelector(
        "#current-puzzle-display"
    ),

    correctEquationDisplay: document.querySelector(
        "#correct-equation-display"
    ),

    currentTurnDisplay: document.querySelector(
        "#current-turn-display"
    )
};

/*
====================================================
STATE SETUP
====================================================
*/

function ensureStateShape() {
    if (!state.settings) {
        state.settings = {
            minimumNumber: 1,
            maximumNumber: 20
        };
    }

    if (!state.timer) {
        state.timer = {
            enabled: false,
            duration: 30,
            remaining: 30,
            running: false,
            endTime: null
        };
    }

    if (!Array.isArray(state.selectedIndexes)) {
        state.selectedIndexes = [];
    }

    if (!Array.isArray(state.players)) {
        state.players = [];
    }

    while (state.players.length < PLAYER_LIMIT) {
        const index = state.players.length;

        state.players.push({
            name: `Player ${index + 1}`,
            score: 0,
            attempts: 0,
            correct: 0
        });
    }
}

function saveState(reason) {
    stateApi.saveState({
        reason
    });
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

    state.settings.minimumNumber = minimum;
    state.settings.maximumNumber = maximum;

    stopTimer();

    if (state.puzzle.length === 4) {
        advancePlayer(1);
    }

    try {
        const puzzle =
            createPuzzle(minimum, maximum);

        state.puzzle = puzzle.numbers;
        state.correctAddends = puzzle.addends;
        state.sum = puzzle.sum;
        state.equation = puzzle.equation;
        state.selectedIndexes = [];
        state.status = "OPEN";
        state.totalPuzzles += 1;

        if (state.timer.enabled) {
            startTimer();
        } else {
            resetTimerToDuration();
        }

        saveState("new-puzzle");
    } catch (error) {
        window.alert(error.message);
    }
}

/*
====================================================
TIMER
====================================================
*/

function startTimer() {
    if (
        !state.timer.enabled ||
        state.status !== "OPEN" ||
        state.puzzle.length !== 4
    ) {
        return;
    }

    state.timer.remaining =
        state.timer.duration;

    state.timer.running = true;

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
            Number(state.timer.remaining) || 0
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

function monitorTimer() {
    if (
        !state.timer.running ||
        !state.timer.endTime
    ) {
        renderTimer();
        return;
    }

    const millisecondsRemaining =
        state.timer.endTime - Date.now();

    state.timer.remaining =
        Math.max(
            0,
            Math.ceil(
                millisecondsRemaining / 1000
            )
        );

    renderTimer();

    if (
        millisecondsRemaining <= 0 &&
        state.status === "OPEN"
    ) {
        handleTimeUp();
    }
}

function handleTimeUp() {
    stopTimer();

    state.timer.remaining = 0;
    state.selectedIndexes = [];
    state.status = "TIME_UP";

    saveState("time-up");
}

function updateTimerEnabled() {
    state.timer.enabled =
        elements.timerToggle.checked;

    stopTimer();
    resetTimerToDuration();

    if (
        state.timer.enabled &&
        state.status === "OPEN" &&
        state.puzzle.length === 4
    ) {
        startTimer();
    }

    saveState("timer-toggle");
}

function updateTimerDuration() {
    const duration =
        Number.parseInt(
            elements.timerDuration.value,
            10
        );

    if (
        ![5, 10, 15, 30, 45, 60]
            .includes(duration)
    ) {
        return;
    }

    state.timer.duration = duration;
    state.timer.remaining = duration;

    stopTimer();

    if (
        state.timer.enabled &&
        state.status === "OPEN" &&
        state.puzzle.length === 4
    ) {
        startTimer();
    }

    saveState("timer-duration");
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

    state.selectedIndexes = [];
    state.status = "REVEALED";

    saveState("answer-revealed");
}

function advancePlayer(direction) {
    state.activePlayerIndex =
        (
            state.activePlayerIndex +
            direction +
            state.playerCount
        ) % state.playerCount;
}

function movePlayer(direction) {
    stopTimer();

    state.selectedIndexes = [];
    advancePlayer(direction);

    if (
        state.puzzle.length === 4 &&
        (
            state.status === "OPEN" ||
            state.status === "TIME_UP" ||
            state.status === "TRY_AGAIN"
        )
    ) {
        state.status = "OPEN";

        if (state.timer.enabled) {
            startTimer();
        } else {
            resetTimerToDuration();
        }
    }

    saveState(
        direction > 0
            ? "next-player"
            : "previous-player"
    );
}

function nextPlayer() {
    movePlayer(1);
}

function previousPlayer() {
    movePlayer(-1);
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

    saveState("board-reset");
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

    saveState("session-reset");
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
        state.playerCount
    ) {
        state.activePlayerIndex = 0;
    }

    saveState("player-count");
}

function updateNumberSettings() {
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

    if (Number.isInteger(minimum)) {
        state.settings.minimumNumber =
            minimum;
    }

    if (Number.isInteger(maximum)) {
        state.settings.maximumNumber =
            maximum;
    }

    saveState("number-settings");
}

function updatePlayerName(index, value) {
    const trimmedName =
        value.trim();

    state.players[index].name =
        trimmedName ||
        `Player ${index + 1}`;

    saveState("player-name");
}

/*
====================================================
GRADES
====================================================
*/

function calculateGrade(percentage) {
    if (percentage >= 97) return "A+";
    if (percentage >= 93) return "A";
    if (percentage >= 90) return "A-";

    if (percentage >= 87) return "B+";
    if (percentage >= 83) return "B";
    if (percentage >= 80) return "B-";

    if (percentage >= 77) return "C+";
    if (percentage >= 73) return "C";
    if (percentage >= 70) return "C-";

    if (percentage >= 67) return "D+";
    if (percentage >= 63) return "D";
    if (percentage >= 60) return "D-";

    return "F";
}

/*
====================================================
RENDERING
====================================================
*/

function render() {
    renderStatus();
    renderActivePlayer();
    renderSummary();
    renderPerformanceTable();
    renderSessionDetails();
    renderSettings();
    renderTimer();
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

function renderActivePlayer() {
    const activePlayer =
        state.players[
        state.activePlayerIndex
        ];

    const activeName =
        activePlayer?.name || "Player 1";

    elements.activePlayerName.textContent =
        activeName;

    elements.currentTurnDisplay.textContent =
        activeName;
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

function renderPerformanceTable() {
    elements.performanceTable.innerHTML = "";

    state.players.forEach(
        (player, index) => {
            const row =
                document.createElement("div");

            row.className =
                "performance-row";

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

            const percentage =
                player.attempts > 0
                    ? (
                        player.correct /
                        player.attempts
                    ) * 100
                    : null;

            const nameInput =
                document.createElement("input");

            nameInput.className =
                "performance-name-input";

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
                createTableCell(
                    String(player.score)
                );

            const turn =
                createTableCell(
                    isActive ? "▶" : ""
                );

            const attempts =
                createTableCell(
                    String(player.attempts)
                );

            const correct =
                createTableCell(
                    String(player.correct)
                );

            const percent =
                createTableCell(
                    percentage === null
                        ? "—"
                        : percentage.toFixed(2) + "%"
                );

            const grade =
                createTableCell(
                    percentage === null
                        ? "—"
                        : calculateGrade(percentage)
                );

            grade.classList.add(
                "grade-cell"
            );

            row.append(
                nameInput,
                score,
                turn,
                attempts,
                correct,
                percent,
                grade
            );

            elements.performanceTable.append(
                row
            );
        }
    );
}

function createTableCell(text) {
    const cell =
        document.createElement("span");

    cell.textContent = text;

    return cell;
}

function renderSessionDetails() {
    elements.currentPuzzleDisplay.textContent =
        state.puzzle.length === 4
            ? state.puzzle.join("  •  ")
            : "No puzzle generated";

    elements.correctEquationDisplay.textContent =
        state.equation || "Hidden";
}

function renderSettings() {
    elements.playerCount.value =
        String(state.playerCount);

    elements.minimumNumber.value =
        String(
            state.settings.minimumNumber
        );

    elements.maximumNumber.value =
        String(
            state.settings.maximumNumber
        );

    elements.timerToggle.checked =
        state.timer.enabled;

    elements.timerDuration.value =
        String(state.timer.duration);
}

function renderTimer() {
    const remaining =
        getLiveTimerRemaining();

    elements.timerDisplay.textContent =
        formatTimer(remaining);

    elements.timerToggleLabel.textContent =
        state.timer.enabled
            ? "ON"
            : "OFF";

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

    stateApi.subscribe(() => {
        render();
    });

    window.setInterval(
        monitorTimer,
        200
    );
}

/*
====================================================
START
====================================================
*/

function startTeacherControls() {
    ensureStateShape();
    connectEvents();
    render();

    saveState("teacher-opened");
}

startTeacherControls();