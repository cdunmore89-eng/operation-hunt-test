"use strict";

/*
====================================================
OPERATION HUNT — TARGET BOARD PRESENTATION
Adds accessibility metadata and arrow-key navigation to
existing puzzle buttons. It never changes puzzle state.
====================================================
*/

(function connectBoardPresentation() {
    const board =
        document.querySelector("#puzzle-board");

    if (!board) {
        return;
    }

    function getGridSize() {
        const match = Array.from(board.classList)
            .map(className =>
                /^grid-size-(\d+)$/.exec(className)
            )
            .find(Boolean);

        const gridSize = match
            ? Number.parseInt(match[1], 10)
            : 0;

        return [2, 3, 4, 5].includes(gridSize)
            ? gridSize
            : 2;
    }

    function getCells() {
        return Array.from(
            board.querySelectorAll(".puzzle-cell")
        );
    }

    function describeCell(cell, index) {
        const value = cell.textContent.trim() ||
            `position ${index + 1}`;

        const states = [];

        if (
            cell.classList.contains("selected") ||
            cell.classList.contains("target-locked")
        ) {
            states.push("selected, target locked");
        }

        if (
            cell.classList.contains("correct") ||
            cell.classList.contains("target-matched")
        ) {
            states.push("target matched");
        }

        if (cell.classList.contains("struck")) {
            states.push("already used");
        }

        if (cell.disabled && states.length === 0) {
            states.push("unavailable");
        }

        return states.length > 0
            ? `Number ${value}. ${states.join(". ")}.`
            : `Number ${value}.`;
    }

    function syncBoardPresentation() {
        const gridSize = getGridSize();
        const cells = getCells();

        board.setAttribute("role", "group");
        board.setAttribute(
            "aria-label",
            `Operation Hunt ${gridSize} by ${gridSize} target board`
        );

        cells.forEach((cell, index) => {
            cell.removeAttribute("role");
            cell.setAttribute(
                "aria-pressed",
                cell.classList.contains("selected") ||
                cell.classList.contains("target-locked")
                    ? "true"
                    : "false"
            );
            cell.setAttribute(
                "aria-label",
                describeCell(cell, index)
            );
        });
    }

    function focusCellByIndex(targetIndex) {
        const cells = getCells();

        if (
            targetIndex < 0 ||
            targetIndex >= cells.length
        ) {
            return;
        }

        const target = cells[targetIndex];

        if (!target.disabled) {
            target.focus();
        }
    }

    function findNextEnabledIndex(
        startIndex,
        step,
        gridSize
    ) {
        const cells = getCells();
        let candidate = startIndex + step;

        while (
            candidate >= 0 &&
            candidate < cells.length
        ) {
            const sameRowRequired =
                Math.abs(step) === 1;

            if (sameRowRequired) {
                const startRow =
                    Math.floor(startIndex / gridSize);
                const candidateRow =
                    Math.floor(candidate / gridSize);

                if (startRow !== candidateRow) {
                    return startIndex;
                }
            }

            if (!cells[candidate].disabled) {
                return candidate;
            }

            candidate += step;
        }

        return startIndex;
    }

    board.addEventListener("keydown", event => {
        const cell = event.target.closest(
            ".puzzle-cell"
        );

        if (!cell || !board.contains(cell)) {
            return;
        }

        const cells = getCells();
        const currentIndex = cells.indexOf(cell);
        const gridSize = getGridSize();
        const steps = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -gridSize,
            ArrowDown: gridSize
        };

        const step = steps[event.key];

        if (!step) {
            return;
        }

        event.preventDefault();

        const nextIndex = findNextEnabledIndex(
            currentIndex,
            step,
            gridSize
        );

        focusCellByIndex(nextIndex);
    });

    const observer = new MutationObserver(
        syncBoardPresentation
    );

    observer.observe(board, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
        characterData: true
    });

    syncBoardPresentation();
})();
