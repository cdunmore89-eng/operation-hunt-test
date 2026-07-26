"use strict";

(function connectMultiplicationPresentation() {
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
            "Operation Hunt multiplication presentation could not initialize."
        );
        return;
    }

    const OPERATIONS = arithmeticEngine.OPERATIONS;

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

    buildEquationFromSelection =
        function buildArithmeticEquation(options = {}) {
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
                ? arithmeticEngine.calculateResult(
                    getOperation(),
                    selectedValues
                )
                : "?";

            return `${leftSide} = ${result}`;
        };

    renderGameMode = function renderArithmeticGameMode() {
        const maxOut = isMaxOutMode();
        const practice = isPracticeMode();
        const operation = getOperation();
        const config = getOperationConfig();
        const termCount = state.settings.requiredAddends;

        elements.gameMode.value = state.gameMode;
        operationSelect.value = operation;

        elements.gameModeDescription.textContent =
            practice
                ? `Endless no-timer ${config.name.toLowerCase()} practice with session stats.`
                : maxOut
                    ? `Clear as many ${config.name.toLowerCase()} puzzles as possible before time expires.`
                    : `Complete one ${config.name.toLowerCase()} target equation per puzzle.`;

        if (operation === OPERATIONS.SUBTRACTION) {
            const subtractCount = termCount - 1;

            elements.gameInstructions.textContent = practice
                ? `Select the starting number first, then ${subtractCount} number${subtractCount === 1 ? "" : "s"} to subtract. Match the difference and keep practicing.`
                : maxOut
                    ? `Select the starting number first, then subtract ${subtractCount} term${subtractCount === 1 ? "" : "s"}. Match as many differences as possible before time expires.`
                    : `Select the starting number first, then subtract ${subtractCount} term${subtractCount === 1 ? "" : "s"}. Strike the matching difference on the radar.`;
        } else if (operation === OPERATIONS.MULTIPLICATION) {
            elements.gameInstructions.textContent = practice
                ? `Select ${termCount} factors in any order. Match their product and keep practicing.`
                : maxOut
                    ? `Select ${termCount} factors in any order. Match as many products as possible before time expires.`
                    : `Select ${termCount} factors in any order and strike their matching product on the radar.`;
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
            operation === OPERATIONS.ADDITION
        );
        document.body.classList.toggle(
            "operation-subtraction",
            operation === OPERATIONS.SUBTRACTION
        );
        document.body.classList.toggle(
            "operation-multiplication",
            operation === OPERATIONS.MULTIPLICATION
        );

        if (practice) {
            state.timer.enabled = false;
            stopTimer();
            resetTimerToDuration();
        }

        if (runningResultLabel) {
            runningResultLabel.textContent =
                config.runningLabel ||
                `Show Running ${config.resultName}`;
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
