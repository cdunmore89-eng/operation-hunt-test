"use strict";

/*
====================================================
OPERATION HUNT — DEMO FEEDBACK PRESENTATION
Observes existing status output and applies visual-only
classes to the equation and feedback components.
====================================================
*/

(function connectFeedbackPresentation() {
    const statusDisplay =
        document.querySelector("#session-status");

    const equationCard =
        document.querySelector(".demo-equation-card");

    const equationDisplay =
        document.querySelector("#equation-display");

    const feedbackStrip =
        document.querySelector(".demo-feedback-strip");

    const feedbackCards =
        feedbackStrip
            ? Array.from(
                feedbackStrip.querySelectorAll(
                    "[data-feedback]"
                )
            )
            : [];

    if (
        !statusDisplay ||
        !equationCard ||
        !equationDisplay ||
        !feedbackStrip ||
        feedbackCards.length === 0
    ) {
        return;
    }

    function getFeedbackState() {
        const status = statusDisplay.textContent
            .trim()
            .toUpperCase();

        if (status.startsWith("TARGET LOCKED")) {
            return "locked";
        }

        if (
            status === "STRIKE" ||
            status === "PUZZLE COMPLETE" ||
            status === "ANSWER REVEALED"
        ) {
            return "matched";
        }

        if (status === "MISS") {
            return "miss";
        }

        return "";
    }

    function syncFeedbackPresentation() {
        const state = getFeedbackState();

        equationCard.classList.toggle(
            "feedback-locked",
            state === "locked"
        );

        equationCard.classList.toggle(
            "feedback-matched",
            state === "matched"
        );

        equationCard.classList.toggle(
            "feedback-miss",
            state === "miss"
        );

        feedbackStrip.classList.toggle(
            "has-active",
            Boolean(state)
        );

        feedbackCards.forEach(card => {
            const active =
                card.dataset.feedback === state;

            card.classList.toggle(
                "is-active",
                active
            );

            card.setAttribute(
                "aria-current",
                active ? "true" : "false"
            );
        });

        const equation =
            equationDisplay.textContent.trim();

        equationCard.setAttribute(
            "aria-label",
            state
                ? `${state} feedback. Equation: ${equation}`
                : `Equation: ${equation}`
        );
    }

    const statusObserver =
        new MutationObserver(
            syncFeedbackPresentation
        );

    statusObserver.observe(
        statusDisplay,
        {
            childList: true,
            characterData: true,
            subtree: true
        }
    );

    const equationObserver =
        new MutationObserver(
            syncFeedbackPresentation
        );

    equationObserver.observe(
        equationDisplay,
        {
            childList: true,
            characterData: true,
            subtree: true
        }
    );

    syncFeedbackPresentation();
})();
