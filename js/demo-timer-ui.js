"use strict";

/*
====================================================
OPERATION HUNT — DEMO TIMER PRESENTATION
Observes the existing timer output and adds visual-only
warning/accessibility states. It never controls countdown logic.
====================================================
*/

(function connectTimerPresentation() {
    const timerCard =
        document.querySelector("#timer-card");

    const timerDisplay =
        document.querySelector("#timer-display");

    const timerCaption =
        document.querySelector("#timer-caption");

    if (
        !timerCard ||
        !timerDisplay ||
        !timerCaption
    ) {
        return;
    }

    function parseTimerSeconds(value) {
        const parts = String(value)
            .trim()
            .split(":")
            .map(part => Number.parseInt(part, 10));

        if (
            parts.length !== 2 ||
            parts.some(part => !Number.isInteger(part))
        ) {
            return 0;
        }

        return Math.max(
            0,
            parts[0] * 60 + parts[1]
        );
    }

    function syncTimerPresentation() {
        const remaining =
            parseTimerSeconds(
                timerDisplay.textContent
            );

        const disabled =
            timerCard.classList.contains(
                "timer-disabled"
            );

        const expired =
            timerCard.classList.contains(
                "time-up"
            );

        const warning =
            !disabled &&
            !expired &&
            remaining > 0 &&
            remaining <= 10;

        timerCard.classList.toggle(
            "timer-warning",
            warning
        );

        const caption =
            timerCaption.textContent
                .trim()
                .toLowerCase();

        timerCard.setAttribute(
            "aria-label",
            `${remaining} seconds remaining. ${caption}.`
        );
    }

    const displayObserver =
        new MutationObserver(
            syncTimerPresentation
        );

    displayObserver.observe(
        timerDisplay,
        {
            childList: true,
            characterData: true,
            subtree: true
        }
    );

    const cardObserver =
        new MutationObserver(
            syncTimerPresentation
        );

    cardObserver.observe(
        timerCard,
        {
            attributes: true,
            attributeFilter: ["class"]
        }
    );

    syncTimerPresentation();
})();
