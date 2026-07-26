"use strict";

/*
====================================================
OPERATION HUNT — MISSION SHELL PRESENTATION
Maps existing session text to visual and accessibility states.
It never changes gameplay, scoring, timers, or turn order.
====================================================
*/

(function connectMissionShellPresentation() {
    const statusCard =
        document.querySelector(".demo-status-card");

    const statusDisplay =
        document.querySelector("#session-status");

    const activeCard =
        document.querySelector(".demo-active-card");

    const activePlayerLabel =
        document.querySelector("#active-player-label");

    const activePlayerName =
        document.querySelector("#active-player-name");

    if (
        !statusCard ||
        !statusDisplay ||
        !activeCard ||
        !activePlayerLabel ||
        !activePlayerName
    ) {
        return;
    }

    const stateClasses = [
        "status-waiting",
        "status-open",
        "status-locked",
        "status-matched",
        "status-revealed",
        "status-miss",
        "status-expired"
    ];

    let previousState = "";
    let animationTimeoutId = null;

    statusCard.setAttribute("role", "status");
    statusCard.setAttribute("aria-live", "polite");
    statusCard.setAttribute("aria-atomic", "true");

    activeCard.setAttribute("role", "region");
    activeCard.setAttribute("aria-label", "Active agent");
    activePlayerName.setAttribute("aria-live", "polite");

    function getStatusState() {
        const status = statusDisplay.textContent
            .trim()
            .toUpperCase();

        if (status === "WAITING FOR PUZZLE") {
            return "waiting";
        }

        if (status.startsWith("TARGET LOCKED")) {
            return "locked";
        }

        if (status === "ROUND OPEN") {
            return "open";
        }

        if (
            status === "STRIKE" ||
            status === "PUZZLE COMPLETE"
        ) {
            return "matched";
        }

        if (status === "ANSWER REVEALED") {
            return "revealed";
        }

        if (status === "MISS") {
            return "miss";
        }

        if (status === "TIME UP") {
            return "expired";
        }

        return "open";
    }

    function animateStatusChange() {
        statusCard.classList.remove("status-updated");
        void statusCard.offsetWidth;
        statusCard.classList.add("status-updated");

        if (animationTimeoutId !== null) {
            window.clearTimeout(animationTimeoutId);
        }

        animationTimeoutId = window.setTimeout(() => {
            statusCard.classList.remove("status-updated");
            animationTimeoutId = null;
        }, 420);
    }

    function syncShellPresentation() {
        const state = getStatusState();
        const statusText = statusDisplay.textContent.trim();
        const activeLabel = activePlayerLabel.textContent.trim();
        const activeName = activePlayerName.textContent.trim();

        stateClasses.forEach(className => {
            statusCard.classList.remove(className);
        });

        statusCard.classList.add(`status-${state}`);
        statusCard.dataset.status = state;
        statusCard.setAttribute(
            "aria-label",
            `Session status: ${statusText}`
        );

        activeCard.setAttribute(
            "aria-label",
            `${activeLabel}: ${activeName}`
        );

        if (state !== previousState) {
            animateStatusChange();
            previousState = state;
        }
    }

    const statusObserver = new MutationObserver(
        syncShellPresentation
    );

    statusObserver.observe(statusDisplay, {
        childList: true,
        characterData: true,
        subtree: true
    });

    const activeObserver = new MutationObserver(
        syncShellPresentation
    );

    activeObserver.observe(activePlayerLabel, {
        childList: true,
        characterData: true,
        subtree: true
    });

    activeObserver.observe(activePlayerName, {
        childList: true,
        characterData: true,
        subtree: true
    });

    window.addEventListener("beforeunload", () => {
        if (animationTimeoutId !== null) {
            window.clearTimeout(animationTimeoutId);
        }
    });

    syncShellPresentation();
})();
