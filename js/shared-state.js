"use strict";

const STORAGE_KEY = "operation-hunt-state";
const CHANNEL_NAME = "operation-hunt-channel";
const MAX_PLAYERS = 6;

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

function createDefaultState() {
    return {
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
            endTime: null
        }
    };
}

function loadState() {
    const savedState =
        window.localStorage.getItem(STORAGE_KEY);

    if (!savedState) {
        return createDefaultState();
    }

    try {
        const parsedState =
            JSON.parse(savedState);

        return {
            ...createDefaultState(),
            ...parsedState,

            players:
                Array.isArray(parsedState.players)
                    ? parsedState.players
                    : createDefaultPlayers(),

            timer: {
                ...createDefaultState().timer,
                ...(parsedState.timer || {})
            }
        };
    } catch (error) {
        console.error(
            "Could not load saved game state:",
            error
        );

        return createDefaultState();
    }
}

const sharedState = loadState();

const gameChannel =
    "BroadcastChannel" in window
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;

function saveState(options = {}) {
    const {
        broadcast = true,
        reason = "state-updated"
    } = options;

    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(sharedState)
    );

    if (broadcast && gameChannel) {
        gameChannel.postMessage({
            type: "STATE_UPDATED",
            reason,
            state: sharedState
        });
    }

    window.dispatchEvent(
        new CustomEvent("operationhuntstatechange", {
            detail: {
                reason,
                state: sharedState
            }
        })
    );
}

function replaceState(nextState, reason = "state-replaced") {
    const freshState = {
        ...createDefaultState(),
        ...nextState,

        players:
            Array.isArray(nextState.players)
                ? nextState.players
                : createDefaultPlayers(),

        timer: {
            ...createDefaultState().timer,
            ...(nextState.timer || {})
        }
    };

    Object.keys(sharedState).forEach(key => {
        delete sharedState[key];
    });

    Object.assign(sharedState, freshState);

    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(sharedState)
    );

    window.dispatchEvent(
        new CustomEvent("operationhuntstatechange", {
            detail: {
                reason,
                state: sharedState
            }
        })
    );
}

function resetSharedState() {
    replaceState(
        createDefaultState(),
        "state-reset"
    );

    if (gameChannel) {
        gameChannel.postMessage({
            type: "STATE_UPDATED",
            reason: "state-reset",
            state: sharedState
        });
    }
}

function getSharedState() {
    return sharedState;
}

function subscribeToState(callback) {
    const listener = event => {
        callback(
            event.detail.state,
            event.detail.reason
        );
    };

    window.addEventListener(
        "operationhuntstatechange",
        listener
    );

    return () => {
        window.removeEventListener(
            "operationhuntstatechange",
            listener
        );
    };
}

if (gameChannel) {
    gameChannel.addEventListener(
        "message",
        event => {
            const message = event.data;

            if (
                !message ||
                message.type !== "STATE_UPDATED" ||
                !message.state
            ) {
                return;
            }

            replaceState(
                message.state,
                message.reason || "broadcast-update"
            );
        }
    );
}

window.addEventListener(
    "storage",
    event => {
        if (
            event.key !== STORAGE_KEY ||
            !event.newValue
        ) {
            return;
        }

        try {
            const parsedState =
                JSON.parse(event.newValue);

            replaceState(
                parsedState,
                "storage-update"
            );
        } catch (error) {
            console.error(
                "Could not process storage update:",
                error
            );
        }
    }
);

window.OperationHuntState = {
    MAX_PLAYERS,
    getState: getSharedState,
    saveState,
    replaceState,
    resetState: resetSharedState,
    subscribe: subscribeToState
};