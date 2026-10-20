"use strict";

/*
Operation Hunt — Teacher / Smart Board wiring tests (Section G).
Run: node ~/workspace/operation-hunt/test-teacher-smartboard.js

Seams tested, honestly:
- js/shared-state.js IS loaded standalone in node. It only touches
  window.localStorage, window.add/removeEventListener,
  window.dispatchEvent(new CustomEvent(...)) and BroadcastChannel,
  so all four are stubbed below and the module's real exported API
  (window.OperationHuntState) is exercised: defaults, setOperation,
  setAllowNegatives, saveState -> localStorage -> fresh-load
  round-trip, and replaceState normalization (the same function the
  BroadcastChannel / storage-event paths use).
- js/teacher.js and js/smartboard.js are full DOM controllers and
  cannot be loaded without a DOM, so their wiring is verified with
  source-level assertions for the exact engine calls and control ids
  they must use. The engine behaviour those calls rely on (strict
  click-order findComboForOperation, generation per operation) is
  covered functionally by test-multi-op.js, which this file re-runs
  in full as the regression suite.
*/

const fs = require("fs");
const { execFileSync } = require("child_process");

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

/* ---------------- browser stubs ---------------- */

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

/* ---------------- G1: defaults on a fresh load ---------------- */

{
    const storage = {};
    const api = loadSharedState(storage);
    const state = api.getState();

    assert(state.settings.operation === "addition", "G1: default operation is addition");
    assert(state.settings.allowNegatives === false, "G1: default allowNegatives is false");
    assert(state.settings.minimumNumber === 1, "G1: default minimumNumber is 1");
    assert(api.OPERATIONS.join(",") === "addition,subtraction,multiplication,division",
        "G1: exported operation id list matches the engine");
    assert(api.normalizeOperation("division") === "division", "G1: normalizeOperation keeps division");
    assert(api.normalizeOperation("bogus") === "addition", "G1: normalizeOperation falls back to addition");
}

/* ---------------- G2: round-trip through localStorage ---------------- */

{
    const storage = {};
    const api = loadSharedState(storage);
    const state = api.getState();

    api.setOperation("division");
    assert(state.settings.operation === "division", "G2: setOperation stores division");

    api.setAllowNegatives(true);
    assert(state.settings.allowNegatives === true, "G2: setAllowNegatives stores true");

    state.settings.minimumNumber = -10;
    api.saveState({ reason: "test" });

    const saved = JSON.parse(storage["operation-hunt-state"]);
    assert(saved.settings.operation === "division", "G2: saved JSON carries operation");
    assert(saved.settings.allowNegatives === true, "G2: saved JSON carries allowNegatives");
    assert(saved.settings.minimumNumber === -10, "G2: saved JSON carries minimumNumber -10");

    // Fresh module load against the same storage = a second screen opening.
    const api2 = loadSharedState(storage);
    const state2 = api2.getState();

    assert(state2.settings.operation === "division", "G2: reloaded state keeps operation division");
    assert(state2.settings.allowNegatives === true, "G2: reloaded state keeps allowNegatives true");
    assert(state2.settings.minimumNumber === -10, "G2: reloaded state keeps minimumNumber -10");

    api2.setOperation("not-an-operation");
    assert(api2.getState().settings.operation === "addition",
        "G2: setOperation normalizes an invalid id to addition");
}

/* ---------------- G3: minimum clamp, both directions ---------------- */

{
    const storage = {};
    const api = loadSharedState(storage);

    api.replaceState({ settings: { operation: "subtraction", allowNegatives: true, minimumNumber: -99 } });
    assert(api.getState().settings.minimumNumber === -20,
        "G3: negatives on clamps minimum at the -20 floor");
    assert(api.getState().settings.operation === "subtraction",
        "G3: replaceState preserves a valid operation");

    api.replaceState({ settings: { operation: "subtraction", allowNegatives: true, minimumNumber: -5 } });
    assert(api.getState().settings.minimumNumber === -5,
        "G3: negatives on leaves a legal negative minimum alone");

    api.replaceState({ settings: { operation: "bogus", allowNegatives: false, minimumNumber: -5 } });
    assert(api.getState().settings.minimumNumber === 1,
        "G3: negatives off clamps minimum up to 1");
    assert(api.getState().settings.operation === "addition",
        "G3: replaceState normalizes an invalid operation to addition");
    assert(api.getState().settings.allowNegatives === false,
        "G3: replaceState preserves allowNegatives false");

    // Legacy saved state from before the multi-op build (no new fields).
    api.replaceState({ settings: { gridSize: 2, requiredAddends: 2, minimumNumber: 3, maximumNumber: 20 } });
    assert(api.getState().settings.operation === "addition",
        "G3: legacy state without operation defaults to addition");
    assert(api.getState().settings.allowNegatives === false,
        "G3: legacy state without allowNegatives defaults to false");
    assert(api.getState().settings.minimumNumber === 3,
        "G3: legacy minimum survives normalization");

    // setAllowNegatives(false) re-clamps a negative minimum back to 1.
    api.replaceState({ settings: { allowNegatives: true, minimumNumber: -10 } });
    api.setAllowNegatives(false);
    assert(api.getState().settings.minimumNumber === 1,
        "G3: turning negatives off re-clamps the minimum to 1");
}

/* ---------------- G4: combo records keep operation fields ---------------- */

{
    const storage = {};
    const api = loadSharedState(storage);

    api.replaceState({
        puzzle: [12, 3, 9, 5],
        validCombinations: [{
            addendIndexes: [0, 1],
            resultIndex: 2,
            addendValues: [12, 3],
            resultValue: 9,
            equation: "12 − 3 = 9",
            operandIndexes: [0, 1],
            operandValues: [12, 3],
            operation: "subtraction",
            symbol: "−"
        }]
    });

    const combo = api.getState().validCombinations[0];

    assert(Boolean(combo), "G4: combo survives normalization");
    assert(combo && combo.operation === "subtraction", "G4: combo keeps its operation");
    assert(combo && combo.symbol === "−", "G4: combo keeps its symbol");
    assert(combo && combo.operandIndexes.join(",") === "0,1", "G4: combo keeps operand order (indexes)");
    assert(combo && combo.operandValues.join(",") === "12,3", "G4: combo keeps operand values");
    assert(combo && combo.equation === "12 − 3 = 9", "G4: combo keeps its equation string");
}

/* ---------------- G5: source-level wiring of the two screens ---------------- */

{
    const shared = fs.readFileSync(`${BASE}/js/shared-state.js`, "utf8");
    const teacherJs = fs.readFileSync(`${BASE}/js/teacher.js`, "utf8");
    const teacherHtml = fs.readFileSync(`${BASE}/teacher.html`, "utf8");
    const smartboardJs = fs.readFileSync(`${BASE}/js/smartboard.js`, "utf8");
    const smartboardHtml = fs.readFileSync(`${BASE}/smartboard.html`, "utf8");

    assert(teacherHtml.includes('id="operation"'), "G5: teacher.html has the Operation select");
    assert(teacherHtml.includes('id="allow-negatives-toggle"'), "G5: teacher.html has the Allow Negatives toggle");
    assert(!smartboardHtml.includes('id="operation"') && !smartboardHtml.includes("allow-negatives"),
        "G5: smartboard.html gained NO settings controls (display only)");

    assert(teacherJs.includes('createNumberPuzzle({') && teacherJs.includes("operation: getOperation()"),
        "G5: teacher generatePuzzle passes the operation to the engine");
    assert(teacherJs.includes("allowNegatives: Boolean(state.settings.allowNegatives)"),
        "G5: teacher generatePuzzle passes allowNegatives to the engine");
    assert(teacherJs.includes("puzzleEngine.findCombinations("),
        "G5: teacher Reveal uses the operation-aware findCombinations");
    assert(teacherJs.includes("getMinimumMaximumForOperation"),
        "G5: teacher range enforcement is operation-aware");
    assert(teacherJs.includes("updateOperation") && teacherJs.includes("updateAllowNegatives"),
        "G5: teacher has operation / negatives change handlers");
    assert(teacherJs.includes("setOperation") && teacherJs.includes("setAllowNegatives"),
        "G5: teacher routes structural changes through the shared-state setters");

    assert(smartboardJs.includes("findComboForOperation"),
        "G5: smart board checks answers with strict-order findComboForOperation");
    assert(smartboardJs.includes("operation: getOperation()") &&
        smartboardJs.includes("allowNegatives: Boolean(state.settings.allowNegatives)"),
        "G5: smart board flow generation passes operation + allowNegatives");
    assert(smartboardJs.includes("getOperationVerbPhrase()"),
        "G5: smart board instructions are operation-aware");
    assert(smartboardJs.includes("computeResult"),
        "G5: smart board running result folds with the current operation");

    assert(shared.includes("operation: normalizeOperation(") &&
        shared.includes("allowNegatives: Boolean("),
        "G5: shared-state normalization carries both new settings");
}

/* ---------------- G6: full previous suite (regression) ---------------- */

{
    const output = execFileSync(
        "node",
        ["/home/hatch/workspace/operation-hunt/test-multi-op.js"],
        { encoding: "utf8" }
    );

    const match = output.match(/(\d+) checks, (\d+) failures/);

    assert(Boolean(match), "G6: previous suite produced a summary line");
    assert(match && match[2] === "0", "G6: previous suite reports 0 failures");

    console.log(`G6 regression (test-multi-op.js): ${match ? match[1] : "?"} checks, ${match ? match[2] : "?"} failures`);
}

console.log(`\n${checks} checks, ${failures} failures (Section G only; regression count above)`);

process.exit(failures > 0 ? 1 : 0);
