"use strict";

(function connectOperationController() {
    const arithmeticEngine =
        window.OperationHuntArithmeticEngine;

    const operationSelect =
        document.querySelector("#operation");

    const runningResultLabel =
        document.querySelector("#running-sum-label");

    if (
        !arithmeticEngine ||
        !operationSelect ||
        typeof state !== "object" ||
        typeof elements !== "object"
    ) {
        console.error(
            "Operation Hunt operation controller could not initialize."
        );
        return;
    }

    const OPERATIONS = arithmeticEngine.OPERATIONS;

    state.settings.operation =
        arithmeticEngine.normalizeOperation(
            operationSelect.value
        );

    function getOperation() {
        return arithmeticEngine.normalizeOperation(
            state.settings.operation
        );
    }

    function getOperationConfig() {
        return arithmeticEngine.getOperationConfig(
            getOperation()
        );
    }

    function getOperationResult(values) {
        if (!Array.isArray(values) || values.length === 0) {
            return null;
        }

        if (getOperation() === OPERATIONS.SUBTRACTION) {
            return values.slice(1).reduce(
                (difference, value) =>
                    difference - Number(value),
                Number(values[0])
            );
        }

        return values.reduce(
            (sum, value) => sum + Number(value),
            0
        );
    }

    function updateOperation() {
        const selectedOperation =
            arithmeticEngine.normalizeOperation(
                operationSelect.value
            );

        if (selectedOperation === getOperation()) {
            return;
        }

        const confirmed =
            !puzzleExists() ||
            window.confirm(
                "Changing operations will clear the current puzzle. Continue?"
            );

        if (!confirmed) {
            operationSelect.value = getOperation();
            return;
        }

        clearFeedbackTimeout();
        stopTimer();
        resetPuzzleState();

        state.settings.operation = selectedOperation;
        state.timer.remaining = state.timer.duration;

        enforceNumberRangeForGrid();
        render();
    }

    operationSelect.addEventListener(
        "change",
        updateOperation
    );

    const baseRenderSettings = renderSettings;

    renderSettings = function renderOperationSettings() {
        baseRenderSettings();
        operationSelect.value = getOperation();
    };

    getRequiredMaximumForSettings =
        function getOperationRequiredMaximum(
            minimum,
            gridSize,
            requiredTerms
        ) {
            return arithmeticEngine.getMinimumMaximumForPuzzle(
                getOperation(),
                minimum,
                gridSize * gridSize,
                requiredTerms
            );
        };

    generatePuzzle = function generateOperationPuzzle(
        options = {}
    ) {
        const {
            advanceTurn = true,
            preserveTimer = false
        } = options;

        clearFeedbackTimeout();

        let settings;

        try {
            settings = readNumberSettings();
        } catch (error) {
            window.alert(error.message);
            return;
        }

        if (
            advanceTurn &&
            puzzleExists() &&
            !isPracticeMode()
        ) {
            advancePlayer(1);
        }

        if (!preserveTimer) {
            stopTimer();
        }

        try {
            const generated =
                arithmeticEngine.createPuzzle({
                    operation: getOperation(),
                    minimum: settings.minimum,
                    maximum: settings.maximum,
                    gridSize: settings.gridSize,
                    requiredTerms: settings.requiredAddends
                });

            const primaryCombination =
                generated.combinations[0];

            state.settings.gridSize = settings.gridSize;
            state.settings.requiredAddends =
                settings.requiredAddends;
            state.settings.minimumNumber = settings.minimum;
            state.settings.maximumNumber = settings.maximum;

            state.puzzle = [...generated.numbers];
            state.gridSize = generated.gridSize;
            state.boardSize = generated.boardSize;

            state.selectedIndexes = [];
            state.struckIndexes = [];
            state.matchedTargetIndex = null;
            state.completedTriples = [];

            state.validTriples = [
                ...(generated.triples || [])
            ];

            state.validCombinations = [
                ...(generated.combinations || [])
            ];

            state.equation =
                primaryCombination?.equation || "";

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
    };

    buildEquationFromSelection =
        function buildOperationEquation(options = {}) {
            const {
                showRunningSum = false,
                forceResult = false
            } = options;

            const selectedValues = getSelectedValues();
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

            const config = getOperationConfig();
            const leftSide = [
                ...selectedValues,
                ...emptySlots
            ].join(` ${config.symbol} `);

            const shouldShowResult =
                forceResult ||
                (
                    showRunningSum &&
                    selectedValues.length > 0
                );

            const result = shouldShowResult
                ? getOperationResult(selectedValues)
                : "?";

            return `${leftSide} = ${result}`;
        };

    renderEquation = function renderOperationEquation() {
        const runningResultEnabled =
            state.settings.showRunningSum;

        if (
            state.status === "SOLVED" ||
            state.status === "COMPLETE" ||
            state.status === "REVEALED"
        ) {
            elements.equationDisplay.textContent =
                state.equation || "TARGET MATCHED";
            return;
        }

        if (state.status === "TRY_AGAIN") {
            elements.equationDisplay.textContent =
                state.equation || "MISS — TRY AGAIN";
            return;
        }

        elements.equationDisplay.textContent =
            buildEquationFromSelection({
                showRunningSum: runningResultEnabled
            });
    };

    checkClassicAnswer =
        function checkOperationClassicAnswer(player) {
            const combination =
                arithmeticEngine.findComboForSelection(
                    getOperation(),
                    state.puzzle,
                    state.selectedIndexes,
                    state.settings.requiredAddends,
                    []
                );

            if (!combination) {
                handleMiss(player);
                return;
            }

            awardCorrect(player);

            state.matchedTargetIndex =
                combination.resultIndex;

            state.completedTriples = [
                { ...combination }
            ];

            state.equation = combination.equation;
            state.status = "SOLVED";

            stopTimer();
            render();
            clearFeedbackTimeout();

            feedbackTimeoutId = window.setTimeout(() => {
                feedbackTimeoutId = null;
                state.status = "COMPLETE";
                render();
            }, STRIKE_FEEDBACK_DELAY);
        };

    checkFlowAnswer =
        function checkOperationFlowAnswer(player) {
            const combination =
                arithmeticEngine.findComboForSelection(
                    getOperation(),
                    state.puzzle,
                    state.selectedIndexes,
                    state.settings.requiredAddends,
                    state.struckIndexes
                );

            if (!combination) {
                handleMiss(player);
                return;
            }

            awardCorrect(player);

            state.matchedTargetIndex =
                combination.resultIndex;

            state.completedTriples = [
                ...state.completedTriples,
                { ...combination }
            ];

            state.equation = combination.equation;
            state.status = "SOLVED";
            render();
            clearFeedbackTimeout();

            feedbackTimeoutId = window.setTimeout(() => {
                feedbackTimeoutId = null;

                state.struckIndexes = addUniqueIndexes(
                    state.struckIndexes,
                    combination.indexes
                );

                clearSelection();

                const hasAnotherCombination =
                    arithmeticEngine.hasRemainingCombinations(
                        getOperation(),
                        state.puzzle,
                        state.settings.requiredAddends,
                        state.struckIndexes
                    );

                if (hasAnotherCombination) {
                    state.status = "OPEN";
                    render();
                    return;
                }

                generateNextFlowPuzzle();
            }, STRIKE_FEEDBACK_DELAY);
        };

    const originalRevealAnswer = revealAnswer;

    elements.revealButton.removeEventListener(
        "click",
        originalRevealAnswer
    );

    revealAnswer = function revealOperationAnswer() {
        clearFeedbackTimeout();

        if (!puzzleExists()) {
            window.alert("Generate a puzzle first.");
            return;
        }

        const combinations =
            arithmeticEngine.findCombinations(
                getOperation(),
                state.puzzle,
                state.settings.requiredAddends,
                isFlowMode()
                    ? state.struckIndexes
                    : []
            );

        const combination = combinations[0];

        if (!combination) {
            state.status = "COMPLETE";
            render();
            return;
        }

        stopTimer();

        state.selectedIndexes = [
            ...combination.termIndexes
        ];

        state.matchedTargetIndex =
            combination.resultIndex;

        state.equation = combination.equation;
        state.status = "REVEALED";
        render();
    };

    elements.revealButton.addEventListener(
        "click",
        revealAnswer
    );

    renderGameMode = function renderOperationGameMode() {
        const maxOut = isMaxOutMode();
        const practice = isPracticeMode();
        const config = getOperationConfig();
        const termCount = state.settings.requiredAddends;

        elements.gameMode.value = state.gameMode;

        elements.gameModeDescription.textContent =
            practice
                ? `Endless no-timer ${config.name.toLowerCase()} practice with session stats.`
                : maxOut
                    ? `Clear as many ${config.name.toLowerCase()} puzzles as possible before time expires.`
                    : `Complete one ${config.name.toLowerCase()} target equation per puzzle.`;

        if (getOperation() === OPERATIONS.SUBTRACTION) {
            elements.gameInstructions.textContent = practice
                ? `Select the starting number first, then ${termCount - 1} number${termCount - 1 === 1 ? "" : "s"} to subtract. Match the difference and keep practicing.`
                : maxOut
                    ? `Select the starting number first, then subtract ${termCount - 1} term${termCount - 1 === 1 ? "" : "s"}. Match as many differences as possible before time expires.`
                    : `Select the starting number first, then subtract ${termCount - 1} term${termCount - 1 === 1 ? "" : "s"}. Strike the matching difference on the radar.`;
        } else {
            elements.gameInstructions.textContent = practice
                ? `Practice finding ${termCount} numbers that add to a target. Keep going until the session is reset.`
                : maxOut
                    ? `Find ${termCount} numbers that add to a target. Solve as many as possible before time expires.`
                    : `Find ${termCount} numbers that add to another number on the radar and strike the target.`;
        }

        if (elements.footerModeLabel) {
            const modeName = practice
                ? "Practice"
                : maxOut
                    ? "Max Out"
                    : "Classic Hunt";

            elements.footerModeLabel.textContent =
                `${config.name} • ${modeName}`;
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
        document.body.classList.toggle(
            "operation-addition",
            getOperation() === OPERATIONS.ADDITION
        );
        document.body.classList.toggle(
            "operation-subtraction",
            getOperation() === OPERATIONS.SUBTRACTION
        );

        if (practice) {
            state.timer.enabled = false;
            stopTimer();
            resetTimerToDuration();
        }

        if (runningResultLabel) {
            runningResultLabel.textContent =
                getOperation() === OPERATIONS.SUBTRACTION
                    ? "Show Running Difference"
                    : "Show Running Sum";
        }

        const modeTitle = practice
            ? "Practice"
            : maxOut
                ? "Max Out"
                : "Classic Hunt";

        document.title =
            `Operation Hunt: ${config.name} — ${modeTitle} Demo`;
    };

    render();
})();
