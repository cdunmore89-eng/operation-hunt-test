"use strict";

/*
====================================================
OPERATION HUNT — ADDITION FLOW RULES
Phase 1 regression corrections layered over the approved
Demo controller. This file is intentionally small and will
be absorbed into the multi-operation controller in Phase 2.
====================================================
*/

(function applyApprovedAdditionRules() {
    const requiredFunctions = [
        "clearFeedbackTimeout",
        "clearSelection",
        "addUniqueIndexes",
        "generateNextFlowPuzzle",
        "render"
    ];

    const missingFunction = requiredFunctions.find(
        functionName => typeof globalThis[functionName] !== "function"
    );

    if (
        missingFunction ||
        typeof state !== "object" ||
        typeof elements !== "object" ||
        typeof puzzleEngine !== "object"
    ) {
        console.error(
            "Operation Hunt addition rules could not initialize.",
            missingFunction || "Required Demo state is unavailable."
        );
        return;
    }

    /*
    A manual action must cancel delayed STRIKE/MISS callbacks
    before the action changes the board.
    */
    [
        elements.newPuzzleButton,
        elements.revealButton
    ].forEach(control => {
        control?.addEventListener(
            "click",
            clearFeedbackTimeout,
            { capture: true }
        );
    });

    /*
    A MISS always displays the selected terms and calculated
    result. Running Sum only controls the in-progress preview.
    */
    const approvedRenderEquation = renderEquation;

    renderEquation = function renderApprovedEquation() {
        if (
            state.status === "TRY_AGAIN" &&
            state.equation
        ) {
            elements.equationDisplay.textContent =
                state.equation;
            return;
        }

        approvedRenderEquation();
    };

    /*
    Max Out and Practice keep the same board while another
    non-overlapping valid combination remains. Every term and
    result used in a successful strike becomes unavailable.
    */
    checkFlowAnswer = function checkApprovedFlowAnswer(player) {
        const triple =
            puzzleEngine.findComboForSelection(
                state.puzzle,
                state.selectedIndexes,
                state.settings.requiredAddends,
                state.struckIndexes
            );

        if (!triple) {
            handleMiss(player);
            return;
        }

        awardCorrect(player);

        state.matchedTargetIndex =
            triple.resultIndex;

        state.completedTriples = [
            ...state.completedTriples,
            {
                ...triple
            }
        ];

        state.equation =
            triple.equation;

        state.status = "SOLVED";
        render();

        clearFeedbackTimeout();

        feedbackTimeoutId =
            window.setTimeout(() => {
                feedbackTimeoutId = null;

                state.struckIndexes =
                    addUniqueIndexes(
                        state.struckIndexes,
                        triple.indexes
                    );

                clearSelection();

                const hasAnotherCombination =
                    puzzleEngine.hasRemainingCombinations(
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
})();
