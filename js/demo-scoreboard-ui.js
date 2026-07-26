"use strict";

/*
====================================================
OPERATION HUNT — SCOREBOARD PRESENTATION
Adds semantics, accessible labels, and visual-only score
feedback. It never calculates scores or changes turns.
====================================================
*/

(function connectScoreboardPresentation() {
    const scoreboardPanel =
        document.querySelector(".demo-leaderboard-panel");

    const scoreboardHeader =
        document.querySelector(".scoreboard-header");

    const scoreboard =
        document.querySelector("#scoreboard");

    const activePlayerName =
        document.querySelector("#active-player-name");

    const intelGrid =
        document.querySelector(".demo-intel-grid");

    const metricElements = {
        puzzles: document.querySelector("#total-puzzles"),
        attempts: document.querySelector("#total-attempts"),
        strikes: document.querySelector("#total-correct"),
        accuracy: document.querySelector("#class-accuracy")
    };

    if (
        !scoreboardPanel ||
        !scoreboardHeader ||
        !scoreboard ||
        !intelGrid ||
        Object.values(metricElements).some(element => !element)
    ) {
        return;
    }

    let previousScores = [];
    let previousMetrics = {};

    scoreboardPanel.setAttribute("role", "region");
    scoreboardPanel.setAttribute("aria-label", "Score card");

    scoreboardHeader.setAttribute("role", "row");
    scoreboardHeader
        .querySelectorAll("span")
        .forEach(header => {
            header.setAttribute("role", "columnheader");
        });

    scoreboard.setAttribute("role", "rowgroup");
    intelGrid.setAttribute("role", "status");
    intelGrid.setAttribute("aria-live", "polite");
    intelGrid.setAttribute("aria-atomic", "true");

    if (activePlayerName) {
        activePlayerName.setAttribute("aria-live", "polite");
    }

    function animateElement(element, className) {
        element.classList.remove(className);
        void element.offsetWidth;
        element.classList.add(className);

        window.setTimeout(() => {
            element.classList.remove(className);
        }, 380);
    }

    function syncScoreboard() {
        const rows = Array.from(
            scoreboard.querySelectorAll(".player-row")
        );

        const currentScores = [];

        rows.forEach((row, index) => {
            const nameInput =
                row.querySelector(".player-name-input");

            const cells = Array.from(
                row.querySelectorAll(":scope > span")
            );

            const scoreCell = cells[0];
            const turnCell = cells[1];
            const active = row.classList.contains("active");
            const inactive = row.classList.contains("inactive");
            const playerName =
                nameInput?.value.trim() || `Player ${index + 1}`;

            const score = Number.parseInt(
                scoreCell?.textContent || "0",
                10
            );

            currentScores[index] =
                Number.isInteger(score) ? score : 0;

            row.setAttribute("role", "row");
            row.setAttribute(
                "aria-label",
                `${playerName}, score ${currentScores[index]}${
                    active ? ", active player" : ""
                }${inactive ? ", inactive" : ""}`
            );

            row.setAttribute(
                "aria-current",
                active ? "true" : "false"
            );

            if (nameInput) {
                nameInput.setAttribute(
                    "aria-label",
                    `Player ${index + 1} name`
                );
                nameInput.setAttribute("role", "cell");
            }

            if (scoreCell) {
                scoreCell.setAttribute("role", "cell");
                scoreCell.setAttribute(
                    "aria-label",
                    `Score ${currentScores[index]}`
                );
            }

            if (turnCell) {
                turnCell.setAttribute("role", "cell");
                turnCell.setAttribute(
                    "aria-label",
                    active ? "Current turn" : "Not current turn"
                );
            }

            if (
                previousScores[index] !== undefined &&
                currentScores[index] > previousScores[index]
            ) {
                animateElement(row, "score-updated");
            }
        });

        previousScores = currentScores;
    }

    function syncIntel() {
        const currentMetrics = {
            puzzles: metricElements.puzzles.textContent.trim(),
            attempts: metricElements.attempts.textContent.trim(),
            strikes: metricElements.strikes.textContent.trim(),
            accuracy: metricElements.accuracy.textContent.trim()
        };

        const metricOrder = [
            "puzzles",
            "attempts",
            "strikes",
            "accuracy"
        ];

        metricOrder.forEach((metric, index) => {
            const article = intelGrid.children[index];

            if (
                article &&
                previousMetrics[metric] !== undefined &&
                currentMetrics[metric] !== previousMetrics[metric]
            ) {
                animateElement(article, "metric-updated");
            }
        });

        intelGrid.setAttribute(
            "aria-label",
            `Session Intel. ${currentMetrics.puzzles} puzzles, ` +
            `${currentMetrics.attempts} attempts, ` +
            `${currentMetrics.strikes} strikes, ` +
            `${currentMetrics.accuracy} accuracy.`
        );

        previousMetrics = currentMetrics;
    }

    const scoreboardObserver = new MutationObserver(
        syncScoreboard
    );

    scoreboardObserver.observe(scoreboard, {
        childList: true,
        subtree: true,
        characterData: true
    });

    const intelObserver = new MutationObserver(
        syncIntel
    );

    Object.values(metricElements).forEach(element => {
        intelObserver.observe(element, {
            childList: true,
            characterData: true,
            subtree: true
        });
    });

    syncScoreboard();
    syncIntel();
})();
