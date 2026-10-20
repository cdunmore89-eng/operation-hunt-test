"use strict";

/*
Operation Hunt — ported top-3 fixes + seamless settings tests (Section H).
Run: node ~/workspace/operation-hunt/multi-op/tests/test-port-fixes.js

Covers the 2026-10-20 port of the fixed-v1.1 top-3 fixes onto the
multi-op build, plus Clarence's seamless-settings request:

- H1: source-level wiring — Reset Scores replaced Reset Session in
  demo/teacher (HTML + JS), no resetSession / advanceTurn references
  remain in any active file, all three scoreboard renderers iterate
  players.slice(0, playerCount), and the operation / Allow Negatives
  change handlers no longer confirm-and-clear.
- H2: the keep-vs-redeal decision itself — the engine's
  evaluateBoardForSettings(numbers, { operation, allowNegatives,
  requiredAddends }) — exercised directly: same tiles + a new
  operation with a genuine combination -> keep; tiles illegal under
  the new settings -> redeal; no combination for the new operation
  -> redeal.
- H3: shared-state seams — the in-place setters used by the seamless
  handlers do NOT clear the board (the older setOperation still
  does), the minimum floor clamp still works through them, and a
  teacher-side Reset Scores (in-place zeroing + save) arrives at a
  freshly loaded "second screen" with names kept and scores at 0,
  where players.slice(0, playerCount) yields exactly playerCount
  rows at Agents = 2.
*/

const fs = require("fs");

const BASE = "/home/hatch/workspace/operation-hunt/multi-op";

let failures = 0;
let checks = 0;

function assert(condition, message) {
    checks += 1;

    if (!condition) {
        failures += 1;
        console.error(`FAIL: ${message}`);
    }
}

/* ---------------- engine (loaded like test-multi-op.js) ---------------- */

global.window = global;
require(`${BASE}/js/puzzle-engine.js`);
const engine = global.OperationHuntPuzzleEngine;

assert(typeof engine.evaluateBoardForSettings === "function",
    "H2: engine exports evaluateBoardForSettings");

/* ---------------- H1: source-level wiring ---------------- */

{
    const demoJs = fs.readFileSync(`${BASE}/js/demo.js`, "utf8");
    const teacherJs = fs.readFileSync(`${BASE}/js/teacher.js`, "utf8");
    const smartboardJs = fs.readFileSync(`${BASE}/js/smartboard.js`, "utf8");
    const sharedJs = fs.readFileSync(`${BASE}/js/shared-state.js`, "utf8");
    const demoHtml = fs.readFileSync(`${BASE}/demo.html`, "utf8");
    const teacherHtml = fs.readFileSync(`${BASE}/teacher.html`, "utf8");

    const activeSources = {
        "js/demo.js": demoJs,
        "js/teacher.js": teacherJs,
        "js/smartboard.js": smartboardJs,
        "js/shared-state.js": sharedJs,
        "js/puzzle-engine.js": fs.readFileSync(`${BASE}/js/puzzle-engine.js`, "utf8"),
        "demo.html": demoHtml,
        "teacher.html": teacherHtml,
        "smartboard.html": fs.readFileSync(`${BASE}/smartboard.html`, "utf8")
    };

    for (const [name, source] of Object.entries(activeSources)) {
        assert(!source.includes("resetSession"), `H1: ${name} has no resetSession reference`);
        assert(!source.includes("advanceTurn"), `H1: ${name} has no advanceTurn reference`);
        assert(!source.includes("reset-session"), `H1: ${name} has no reset-session reference`);
        assert(!source.includes("Reset Session"), `H1: ${name} has no "Reset Session" label`);
    }

    assert(demoHtml.includes('id="reset-scores-button"') && demoHtml.includes("Reset Scores"),
        "H1: demo.html button is Reset Scores (#reset-scores-button)");
    assert(teacherHtml.includes('id="reset-scores-button"') && teacherHtml.includes("Reset Scores"),
        "H1: teacher.html button is Reset Scores (#reset-scores-button)");
    assert(demoJs.includes("function resetScores()") && demoJs.includes('"#reset-scores-button"'),
        "H1: demo.js implements and wires resetScores()");
    assert(teacherJs.includes("function resetScores()") && teacherJs.includes('"#reset-scores-button"'),
        "H1: teacher.js implements and wires resetScores()");
    assert(teacherJs.includes('saveState("teacher-reset-scores")'),
        "H1: teacher resetScores saves (broadcasts) the zeroed players");

    assert(demoJs.includes(".slice(0, state.playerCount)"),
        "H1: demo renderScoreboard renders only playerCount rows");
    assert(teacherJs.includes("state.players.slice(0, state.playerCount)"),
        "H1: teacher renderPerformanceTable renders only playerCount rows");
    assert(smartboardJs.includes("state.players.slice(0, state.playerCount)"),
        "H1: smartboard renderScoreboard renders only playerCount rows");

    assert(!demoJs.includes("Changing the operation will clear") &&
        !demoJs.includes("Changing Allow Negatives will clear") &&
        !teacherJs.includes("Changing the operation will clear") &&
        !teacherJs.includes("Changing Allow Negatives will clear"),
        "H1: operation / Allow Negatives changes no longer confirm-and-clear");
    assert(demoJs.includes("applySettingsChangeToBoard") && teacherJs.includes("applySettingsChangeToBoard"),
        "H1: both controllers route settings changes through the seamless board decision");
    assert(teacherJs.includes("setOperationInPlace") && teacherJs.includes("setAllowNegativesInPlace"),
        "H1: teacher writes settings through the shared-state in-place setters");
    assert(sharedJs.includes("setOperationInPlace") && sharedJs.includes("setAllowNegativesInPlace"),
        "H1: shared-state provides the in-place setters");
}

/* ---------------- H2: keep-vs-redeal decision ---------------- */

{
    const decide = (numbers, options) => engine.evaluateBoardForSettings(numbers, options);

    // Same tiles, unchanged operation -> keep (baseline sanity).
    let result = decide([4, 13, 20, 9], { operation: "addition", allowNegatives: false, requiredAddends: 2 });
    assert(result.playable && result.reason === "playable",
        "H2: addition board [4,13,20,9] stays playable for addition");
    assert(result.combinations.some(combo => combo.equation === "4 + 9 = 13"),
        "H2: kept board's recomputed solutions include 4 + 9 = 13");

    // Operation change addition -> subtraction: a genuine combo
    // exists on the same tiles (13 - 4 = 9) -> keep.
    result = decide([4, 13, 20, 9], { operation: "subtraction", allowNegatives: false, requiredAddends: 2 });
    assert(result.playable, "H2: [4,13,20,9] keeps for subtraction (13 - 4 = 9 on the board)");

    // Operation change addition -> division / multiplication: no
    // combo exists on those tiles -> redeal.
    result = decide([4, 13, 20, 9], { operation: "division", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "no-combination",
        "H2: [4,13,20,9] redeals for division (no exact division lands on a tile)");
    result = decide([4, 13, 20, 9], { operation: "multiplication", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "no-combination",
        "H2: [4,13,20,9] redeals for multiplication (no product lands on a tile)");

    // Division keep case: 12 / 3 = 4 is on the board.
    result = decide([12, 3, 4, 7], { operation: "division", allowNegatives: false, requiredAddends: 2 });
    assert(result.playable, "H2: [12,3,4,7] keeps for division (12 / 3 = 4)");
    // ...but 12 / 3 = 4 with the 4 missing redeals, even though
    // 9 / 3 = 3 is arithmetically true (the result tile would
    // have to be an operand tile, which never counts).
    result = decide([12, 3, 9, 5], { operation: "division", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "no-combination",
        "H2: [12,3,9,5] redeals for division (no usable result tile)");

    // [2,3,5,8]: addition keeps (2 + 3 = 5), multiplication redeals.
    result = decide([2, 3, 5, 8], { operation: "addition", allowNegatives: false, requiredAddends: 2 });
    assert(result.playable, "H2: [2,3,5,8] keeps for addition (2 + 3 = 5)");
    result = decide([2, 3, 5, 8], { operation: "multiplication", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "no-combination",
        "H2: [2,3,5,8] redeals for multiplication (2 x 3 = 6 is not a tile)");

    // Allow Negatives OFF with negative tiles on the board ->
    // tiles are illegal under the new settings -> redeal.
    result = decide([-2, 8, -8, -6], { operation: "subtraction", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "illegal-tiles",
        "H2: negative tiles are illegal once Allow Negatives is off");

    // Same board with negatives ON -> keep (-8 - -2 = -6).
    result = decide([-2, 8, -8, -6], { operation: "subtraction", allowNegatives: true, requiredAddends: 2 });
    assert(result.playable && result.combinations.some(combo => combo.resultValue === -6),
        "H2: [-2,8,-8,-6] keeps for subtraction with negatives on (-8 - -2 = -6)");

    // Allow Negatives ON with an all-positive board and the
    // operation unchanged -> the desired seamless case: keep.
    result = decide([4, 13, 20, 9], { operation: "addition", allowNegatives: true, requiredAddends: 2 });
    assert(result.playable,
        "H2: turning negatives ON keeps an all-positive addition board");

    // A zero tile is only legal with negatives on.
    result = decide([0, 4, 9, 5], { operation: "addition", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "illegal-tiles",
        "H2: a 0 tile is illegal with negatives off");
    result = decide([0, 4, 9, 5], { operation: "addition", allowNegatives: true, requiredAddends: 2 });
    assert(result.playable, "H2: [0,4,9,5] keeps for addition with negatives on (4 + 5 = 9)");

    // No board / too-small board -> redeal path.
    result = decide([], { operation: "addition", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "no-board", "H2: empty board reports no-board");
    result = decide([7], { operation: "addition", allowNegatives: false, requiredAddends: 2 });
    assert(!result.playable && result.reason === "no-board", "H2: single tile reports no-board");

    // Multi-term decisions use the same helper (3 terms).
    result = decide([2, 3, 4, 9], { operation: "addition", allowNegatives: false, requiredAddends: 3 });
    assert(result.playable, "H2: [2,3,4,9] keeps for 3-term addition (2 + 3 + 4 = 9)");
    result = decide([2, 3, 4, 8], { operation: "addition", allowNegatives: false, requiredAddends: 3 });
    assert(!result.playable && result.reason === "no-combination",
        "H2: [2,3,4,8] redeals for 3-term addition (no 3-term sum lands on a tile)");
}

/* ---------------- H3: shared-state seams ---------------- */

class CustomEventStub {
    constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
    }
}

class BroadcastChannelStub {
    constructor(name) {
        this.name = name;
        this.listeners = [];
    }

    addEventListener(type, listener) {
        if (type === "message") {
            this.listeners.push(listener);
        }
    }

    postMessage() {}
}

function makeWindow(storageData) {
    const listeners = {};

    return {
        localStorage: {
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(storageData, key)
                    ? storageData[key]
                    : null;
            },
            setItem(key, value) {
                storageData[key] = String(value);
            },
            removeItem(key) {
                delete storageData[key];
            }
        },
        BroadcastChannel: BroadcastChannelStub,
        addEventListener(type, listener) {
            (listeners[type] = listeners[type] || []).push(listener);
        },
        removeEventListener(type, listener) {
            listeners[type] = (listeners[type] || []).filter(item => item !== listener);
        },
        dispatchEvent() {
            return true;
        }
    };
}

function loadSharedState(storageData) {
    global.window = makeWindow(storageData);
    global.BroadcastChannel = BroadcastChannelStub;
    global.CustomEvent = CustomEventStub;

    const path = `${BASE}/js/shared-state.js`;
    delete require.cache[require.resolve(path)];
    require(path);

    return global.window.OperationHuntState;
}

{
    // In-place setters: the board survives a settings change.
    const storage = {};
    const api = loadSharedState(storage);
    const state = api.getState();

    state.puzzle = [4, 13, 20, 9];
    state.status = "OPEN";
    state.settings.minimumNumber = -10;
    api.saveState({ reason: "test-setup" });

    api.setOperationInPlace("division");
    assert(state.settings.operation === "division", "H3: setOperationInPlace stores the operation");
    assert(state.puzzle.join(",") === "4,13,20,9" && state.status === "OPEN",
        "H3: setOperationInPlace does NOT clear the current board");

    api.setAllowNegativesInPlace(true);
    assert(state.puzzle.join(",") === "4,13,20,9",
        "H3: setAllowNegativesInPlace(true) does NOT clear the current board");
    assert(state.settings.minimumNumber === -10,
        "H3: setAllowNegativesInPlace(true) leaves a legal negative minimum alone");

    api.setAllowNegativesInPlace(false);
    assert(state.settings.minimumNumber === 1,
        "H3: setAllowNegativesInPlace(false) still re-clamps the minimum to the floor");
    assert(state.puzzle.join(",") === "4,13,20,9",
        "H3: setAllowNegativesInPlace(false) does NOT clear the current board");

    // Contrast: the older setter keeps its reset behaviour, so the
    // seamless path is a deliberate choice, not an accident.
    api.setOperation("multiplication");
    assert(state.puzzle.length === 0 && state.status === "WAITING",
        "H3: legacy setOperation still resets the board (unchanged behaviour)");
}

{
    // Teacher-side Reset Scores propagation: in-place zeroing on
    // the shared players + save must reach a second screen with
    // names, board, active player and session totals intact.
    const storage = {};
    const teacherApi = loadSharedState(storage);
    const teacherState = teacherApi.getState();

    teacherState.playerCount = 2;
    teacherState.activePlayerIndex = 1;
    teacherState.puzzle = [12, 3, 4, 7];
    teacherState.status = "OPEN";
    teacherState.totalPuzzles = 4;
    teacherState.totalAttempts = 9;
    teacherState.totalCorrect = 5;
    teacherState.players[0].name = "Ada";
    teacherState.players[0].score = 3;
    teacherState.players[0].attempts = 4;
    teacherState.players[0].correct = 3;
    teacherState.players[0].currentStreak = 2;
    teacherState.players[0].bestStreak = 2;
    teacherState.players[1].name = "Bo";
    teacherState.players[1].score = 5;
    teacherApi.saveState({ reason: "test-setup" });

    // Exactly what teacher.js resetScores() does after confirm:
    teacherState.players.forEach(player => {
        player.score = 0;
        player.attempts = 0;
        player.correct = 0;
        player.currentStreak = 0;
        player.bestStreak = 0;
    });
    teacherApi.saveState({ reason: "teacher-reset-scores" });

    // A fresh load against the same storage = the Smart Board's view.
    const boardApi = loadSharedState(storage);
    const boardState = boardApi.getState();

    assert(boardState.players[0].score === 0 && boardState.players[1].score === 0,
        "H3: zeroed scores reach the second screen");
    assert(boardState.players[0].attempts === 0 && boardState.players[0].correct === 0 &&
        boardState.players[0].currentStreak === 0 && boardState.players[0].bestStreak === 0,
        "H3: attempts/correct/streaks are zeroed on the second screen too");
    assert(boardState.players[0].name === "Ada" && boardState.players[1].name === "Bo",
        "H3: player names survive Reset Scores");
    assert(boardState.puzzle.join(",") === "12,3,4,7" && boardState.status === "OPEN",
        "H3: the current board survives Reset Scores");
    assert(boardState.activePlayerIndex === 1,
        "H3: the active player survives Reset Scores");
    assert(boardState.totalPuzzles === 4 && boardState.totalAttempts === 9 && boardState.totalCorrect === 5,
        "H3: Session Intel totals survive Reset Scores");

    // The exact expression all three renderers now use:
    const visibleRows = boardState.players.slice(0, boardState.playerCount);
    assert(visibleRows.length === 2,
        "H3: at Agents = 2 the scoreboard row source yields exactly 2 rows");
    assert(boardState.players.length === 6,
        "H3: hidden rows are a render choice only — all 6 player records still exist");
}

console.log(`\n${checks} checks, ${failures} failures (Section H)`);

process.exit(failures > 0 ? 1 : 0);
