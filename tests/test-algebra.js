"use strict";

/*
Operation Hunt — Algebra Mode tests (Section I).
Run: node ~/workspace/operation-hunt/multi-op/tests/test-algebra.js

Covers the 2026-10-20 fourth pass (Algebra Mode, per
ALGEBRA_MODE_DESIGN.md and Clarence's four decisions):

- I1: every worked example from the design doc, as a unit
  check — banner, tile faces, solution, strike feedback
  (including substitution checks and property lines) and
  trap-naming miss feedback for Solve for x.
- I2: generation sweeps per skill x band x grid x negatives
  (and per operation for Evaluate): every board verifies
  (solvable, exactly one solution, no duplicate faces),
  the solution selection strikes, and — exhaustively on
  small boards — every distractor selection misses.
  Band rules: shapes in K-2, letters from grade 3, Solve
  one-step only before 6-8, the Steps knob honoured,
  click order strict for subtraction/division Evaluate.
- I3: shared-state — new settings defaults + normalizers,
  in-place setters, algebraRound round-trips through
  localStorage, legacy states loading as arithmetic.
- I4: source-level wiring — all three screens load the
  algebra engine, Demo/Teacher carry the controls, the
  Smart Board carries the banner and NO new controls.
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

/* ---------------- engines ---------------- */

global.window = global;
require(`${BASE}/js/puzzle-engine.js`);
require(`${BASE}/js/algebra-engine.js`);

const algebra = global.OperationHuntAlgebraEngine;
const puzzleEngine = global.OperationHuntPuzzleEngine;

assert(typeof algebra.createAlgebraPuzzle === "function",
    "I0: algebra engine exports createAlgebraPuzzle");
assert(typeof algebra.checkAlgebraSelection === "function",
    "I0: algebra engine exports checkAlgebraSelection");
assert(typeof algebra.verifyAlgebraRound === "function",
    "I0: algebra engine exports verifyAlgebraRound");

/* ---------------- I1: worked examples ---------------- */

const EXAMPLE_EXPECTATIONS = [
    {
        id: "missing-k2-add",
        banner: "□ + 7 = 12",
        faces: ["5", "7", "9", "3"],
        solution: [0],
        strikeIncludes: "5 — because 12 − 7 = 5"
    },
    {
        id: "missing-k2-subtract",
        banner: "★ − 4 = 9",
        faces: ["13", "5", "9", "11"],
        solution: [0],
        strikeIncludes: "13 — because 9 + 4 = 13"
    },
    {
        id: "missing-factor",
        banner: "4 × □ = 28",
        faces: ["7", "6", "8", "4"],
        solution: [0],
        strikeIncludes: "7 — because 28 ÷ 4 = 7"
    },
    {
        id: "missing-subtrahend",
        banner: "15 − □ = 9",
        faces: ["6", "5", "9", "4"],
        solution: [0],
        strikeIncludes: "6 — because 15 − 9 = 6"
    },
    {
        id: "missing-two-part",
        banner: "3□ + 2 = 20",
        faces: ["6", "5", "7", "4"],
        solution: [0],
        strikeIncludes: "6 — because (20 − 2) ÷ 3 = 6"
    },
    {
        id: "evaluate-addition",
        banner: "x = 4",
        faces: ["2x", "3", "11", "6"],
        solution: [0, 1, 2],
        strikeIncludes: "2x + 3 = 11 → 8 + 3 = 11"
    },
    {
        id: "evaluate-subtraction",
        banner: "x = 5",
        faces: ["3x", "4", "11", "9"],
        solution: [0, 1, 2],
        strikeIncludes: "3x − 4 = 11 → 15 − 4 = 11"
    },
    {
        id: "evaluate-negatives",
        banner: "x = −2",
        faces: ["2x + 1", "5", "2", "4"],
        solution: [0, 1, 2],
        strikeIncludes: "(2x + 1) + 5 = 2 → −3 + 5 = 2"
    },
    {
        id: "solve-one-step",
        banner: "x + 9 = 17",
        faces: ["8", "26", "9", "7"],
        solution: [0],
        strikeIncludes: "8 + 9 = 17 ✓",
        missIndex: 1,
        missIncludes: "You added — to undo +9, subtract."
    },
    {
        id: "solve-two-step",
        banner: "2x − 3 = 9",
        faces: ["6", "3", "12", "4"],
        solution: [0],
        strikeIncludes: "2(6) − 3 = 9 ✓",
        missIndex: 2,
        missIncludes: "That's 2x, not x — one more step."
    },
    {
        id: "solve-negatives",
        banner: "x − 4 = −9",
        faces: ["−5", "−13", "5", "−4"],
        solution: [0],
        strikeIncludes: "−5 − 4 = −9 ✓",
        missIndex: 1,
        missIncludes: "to undo −4, add"
    },
    {
        id: "equivalent-distributive",
        faces: ["3(x + 2)", "3x + 6", "3x + 2", "x + 6"],
        solution: [0, 1],
        strikeIncludes: "Distributive Property",
        strikeAlsoIncludes: "3(x + 2) = 18 and 3x + 6 = 18",
        missPair: [0, 2],
        missIncludes: "3x + 2 = 14"
    },
    {
        id: "equivalent-combining",
        faces: ["5x + 3 + 2x", "7x + 3", "7x + 5", "10x"],
        solution: [0, 1],
        strikeIncludes: "Combining Like Terms",
        strikeAlsoIncludes: "17 and 7x + 3 = 17",
        missPair: [1, 2],
        missIncludes: ""
    }
];

for (const expected of EXAMPLE_EXPECTATIONS) {
    const round = algebra.createAlgebraExample(expected.id);
    const label = `I1 ${expected.id}`;

    assert(round !== null, `${label}: example builds`);

    if (!round) {
        continue;
    }

    if (expected.banner) {
        assert(round.banner.text === expected.banner,
            `${label}: banner is "${expected.banner}" (got "${round.banner.text}")`);
    }

    assert(
        JSON.stringify(round.tiles.map(tile => tile.face)) === JSON.stringify(expected.faces),
        `${label}: faces are ${expected.faces.join(" | ")} (got ${round.tiles.map(tile => tile.face).join(" | ")})`
    );

    assert(algebra.verifyAlgebraRound(round).valid,
        `${label}: round verifies (exactly one solution)`);

    const selection = round.skill === "evaluate"
        ? [...round.solution.operandIndexes]
        : [...round.solution.indexes];

    const strike = algebra.checkAlgebraSelection(round, selection);

    assert(strike.correct, `${label}: the solution selection strikes`);
    assert(strike.feedback.includes(expected.strikeIncludes),
        `${label}: strike feedback includes "${expected.strikeIncludes}" (got "${strike.feedback}")`);

    if (expected.strikeAlsoIncludes) {
        assert(strike.feedback.includes(expected.strikeAlsoIncludes),
            `${label}: strike feedback also includes "${expected.strikeAlsoIncludes}"`);
    }

    if (expected.missIndex !== undefined) {
        const miss = algebra.checkAlgebraSelection(round, [expected.missIndex]);

        assert(!miss.correct, `${label}: distractor ${expected.missIndex} misses`);
        assert(miss.feedback.includes(expected.missIncludes),
            `${label}: miss names the trap "${expected.missIncludes}" (got "${miss.feedback}")`);
    }

    if (expected.missPair) {
        const miss = algebra.checkAlgebraSelection(round, expected.missPair);

        assert(!miss.correct, `${label}: near-miss pair misses`);

        if (expected.missIncludes) {
            assert(miss.feedback.includes(expected.missIncludes),
                `${label}: pair miss shows the spot-check "${expected.missIncludes}" (got "${miss.feedback}")`);
        }

        // Either click order strikes for Equivalent Expressions.
        const reversed = algebra.checkAlgebraSelection(
            round,
            [...round.solution.indexes].reverse()
        );

        assert(reversed.correct, `${label}: equivalent pair strikes in either click order`);
    }
}

/* Click order is strict for Evaluate subtraction (spec §6):
the design doc's own subtraction example, clicked backwards,
is a miss even though the same three tiles are involved. */
{
    const round = algebra.createAlgebraExample("evaluate-subtraction");
    const [first, second] = round.solution.operandIndexes;

    assert(algebra.checkAlgebraSelection(round, [first, second]).correct,
        "I1: evaluate subtraction strikes in the dealt order");
    assert(!algebra.checkAlgebraSelection(round, [second, first]).correct,
        "I1: evaluate subtraction reversed click order misses");
}

/* ---------------- I2: generation sweeps ---------------- */

function solutionSelection(round) {
    return round.skill === "evaluate"
        ? [...round.solution.operandIndexes]
        : [...round.solution.indexes];
}

function checkRound(round, label, exhaustive) {
    const verification = algebra.verifyAlgebraRound(round);

    assert(verification.valid,
        `${label}: generated round verifies (${verification.errors.join("; ")})`);
    assert(round.tiles.length === round.gridSize * round.gridSize,
        `${label}: tile count matches the grid`);
    assert(new Set(round.tiles.map(tile => tile.face)).size === round.tiles.length,
        `${label}: no duplicate faces`);

    const strike = algebra.checkAlgebraSelection(round, solutionSelection(round));

    assert(strike.correct, `${label}: solution selection strikes`);

    if (!exhaustive) {
        return;
    }

    // Every distractor selection must miss.
    if (round.solution.type === "single") {
        round.tiles.forEach((tile, index) => {
            if (index === round.solution.indexes[0]) {
                return;
            }

            assert(!algebra.checkAlgebraSelection(round, [index]).correct,
                `${label}: distractor tile ${tile.face} misses`);
        });
    } else if (round.skill === "equivalent") {
        for (let first = 0; first < round.tiles.length; first += 1) {
            for (let second = first + 1; second < round.tiles.length; second += 1) {
                const isSolution =
                    round.solution.indexes.includes(first) &&
                    round.solution.indexes.includes(second);

                assert(
                    algebra.checkAlgebraSelection(round, [first, second]).correct === isSolution,
                    `${label}: pair ${first},${second} correctness is ${isSolution}`
                );
            }
        }
    } else {
        // Evaluate: an ordered pair strikes exactly when its
        // fold lands on a third tile AND the three tiles are
        // the round's one solution set (design §2/§6: a
        // solution counts tile sets — the same set read a
        // second true way, like 90 ÷ 9 = 10 alongside
        // 90 ÷ 10 = 9, is the same solution, not a second).
        const values = round.tiles.map(tile => tile.value);
        const solutionSet = [...round.solution.indexes].sort((a, b) => a - b).join(",");

        for (let first = 0; first < round.tiles.length; first += 1) {
            for (let second = 0; second < round.tiles.length; second += 1) {
                if (first === second) {
                    continue;
                }

                let expected = false;
                const folded = puzzleEngine.computeResult(
                    [values[first], values[second]],
                    round.operation
                );

                if (folded !== null && folded !== undefined) {
                    for (let result = 0; result < round.tiles.length; result += 1) {
                        if (result === first || result === second) {
                            continue;
                        }

                        if (values[result] === folded) {
                            const set = [first, second, result].sort((a, b) => a - b).join(",");
                            expected = set === solutionSet;
                        }
                    }
                }

                assert(
                    algebra.checkAlgebraSelection(round, [first, second]).correct === expected,
                    `${label}: ordered pair ${first},${second} correctness is ${expected}`
                );
            }
        }
    }
}

let sweptRounds = 0;

for (const gradeBand of algebra.GRADE_BAND_IDS) {
    for (const skill of algebra.getSkillsForBand(gradeBand)) {
        for (const gridSize of [2, 3, 4, 5]) {
            for (const allowNegatives of [false, true]) {
                const rounds = gridSize <= 3 ? 15 : 8;

                for (let index = 0; index < rounds; index += 1) {
                    const round = algebra.createAlgebraPuzzle({
                        skill,
                        gradeBand,
                        gridSize,
                        allowNegatives,
                        solveSteps: "mixed"
                    });

                    sweptRounds += 1;
                    checkRound(
                        round,
                        `I2 ${gradeBand}/${skill}/${gridSize}x${gridSize}/neg=${allowNegatives}`,
                        gridSize <= 3
                    );

                    if (!allowNegatives) {
                        assert(round.tiles.every(tile => tile.value === null || tile.value >= 0),
                            `I2 ${gradeBand}/${skill}: no negative tile values with negatives off`);
                    }

                    if (skill === "solve") {
                        if (gradeBand === "3-5") {
                            assert(round.question.steps === 1,
                                "I2: 3-5 Solve is always one-step");
                        }

                        if (gradeBand === "6-8") {
                            assert(round.question.steps === 1 || round.question.steps === 2,
                                "I2: 6-8 Solve mixed deals one- or two-step");
                        }
                    }
                }
            }
        }
    }
}

/* Evaluate across all four operations, including the
division click-order rule on generated boards. */
for (const gradeBand of ["3-5", "6-8"]) {
    for (const operation of ["addition", "subtraction", "multiplication", "division"]) {
        for (let index = 0; index < 40; index += 1) {
            const round = algebra.createAlgebraPuzzle({
                skill: "evaluate",
                gradeBand,
                gridSize: 2,
                operation,
                allowNegatives: index % 2 === 0
            });

            sweptRounds += 1;
            checkRound(round, `I2 evaluate/${gradeBand}/${operation}`, true);

            if (operation === "subtraction" || operation === "division") {
                const [first, second] = round.solution.operandIndexes;
                const values = round.tiles.map(tile => tile.value);
                const reversedFold = puzzleEngine.computeResult(
                    [values[second], values[first]],
                    operation
                );

                // Reversed order strikes only in the rare
                // same-set second reading (its fold lands on
                // the solution's own result tile); every other
                // reversed order is a miss (design §6).
                const reversedExpected =
                    reversedFold !== null &&
                    reversedFold !== undefined &&
                    reversedFold === values[round.solution.resultIndex];

                assert(
                    algebra.checkAlgebraSelection(round, [second, first]).correct === reversedExpected,
                    `I2 evaluate/${gradeBand}/${operation}: reversed click order correctness is ${reversedExpected}`
                );
            }
        }
    }
}

/* Band symbol rules: shapes in K-2, the letter x from grade 3. */
for (let index = 0; index < 120; index += 1) {
    const k2 = algebra.createAlgebraPuzzle({ skill: "missing-number", gradeBand: "k-2" });

    assert(/□|★/.test(k2.banner.text) && !/x/.test(k2.banner.text),
        "I2: K-2 Missing Number uses a shape unknown, never x");

    const older = algebra.createAlgebraPuzzle({ skill: "missing-number", gradeBand: "3-5" });

    assert(/□|★|x|n/.test(older.banner.text),
        "I2: 3-5 Missing Number banner carries an unknown (shape or letter)");
}

/* Steps knob: honoured in 6-8, clamped by the band in 3-5. */
for (let index = 0; index < 150; index += 1) {
    const one = algebra.createAlgebraPuzzle({
        skill: "solve", gradeBand: "6-8", solveSteps: "one-step"
    });

    assert(one.question.steps === 1, "I2: Steps=One-step deals only one-step in 6-8");

    const two = algebra.createAlgebraPuzzle({
        skill: "solve", gradeBand: "6-8", solveSteps: "two-step"
    });

    assert(two.question.steps === 2, "I2: Steps=Two-step deals only two-step in 6-8");

    const clamped = algebra.createAlgebraPuzzle({
        skill: "solve", gradeBand: "3-5", solveSteps: "two-step"
    });

    assert(clamped.question.steps === 1, "I2: Steps=Two-step is clamped to one-step in 3-5");
}

/* Mixed deals only the band's skills. */
for (const gradeBand of algebra.GRADE_BAND_IDS) {
    const allowed = algebra.getSkillsForBand(gradeBand);
    const seen = new Set();

    for (let index = 0; index < 200; index += 1) {
        const round = algebra.createAlgebraPuzzle({ skill: "mixed", gradeBand });

        seen.add(round.skill);
        assert(allowed.includes(round.skill),
            `I2: Mixed in ${gradeBand} deals only band skills (got ${round.skill})`);
        assert(algebra.verifyAlgebraRound(round).valid,
            `I2: Mixed round in ${gradeBand} verifies`);
    }

    if (gradeBand === "k-2") {
        assert(seen.size === 1 && seen.has("missing-number"),
            "I2: K-2 Mixed is Missing Number only");
    }
}

/* Distractor composition: named error patterns are the
teaching, so generated Solve boards must actually carry
them (not a shuffled slice of the whole candidate pool). */
{
    let namedBoards = 0;
    const boards = 200;

    for (let index = 0; index < boards; index += 1) {
        const round = algebra.createAlgebraPuzzle({
            skill: "solve", gradeBand: "6-8", solveSteps: "two-step", gridSize: 2
        });

        if (round.tiles.some(tile => (
            tile.errorPatternId &&
            tile.errorPatternId !== "arithmetic-slip"
        ))) {
            namedBoards += 1;
        }

        assert(round.tiles.some(tile => tile.value === round.question.solution),
            "I2: the solution is always dealt onto a Solve board");
    }

    assert(namedBoards >= boards * 0.9,
        `I2: at least 90% of two-step boards carry a named trap (got ${namedBoards}/${boards})`);
}

/* Keep-or-redeal decisions for seamless switching. */
{
    const settings = {
        skill: "evaluate", gradeBand: "3-5", gridSize: 2,
        operation: "addition", allowNegatives: false
    };
    const round = algebra.createAlgebraPuzzle(settings);

    assert(algebra.evaluateAlgebraBoardForSettings(round, settings).playable === true,
        "I2: identical settings keep the algebra board");
    assert(algebra.evaluateAlgebraBoardForSettings(round, { ...settings, skill: "solve" }).playable === false,
        "I2: a skill change redeals");
    assert(algebra.evaluateAlgebraBoardForSettings(round, { ...settings, operation: "multiplication" }).playable === false,
        "I2: addition -> multiplication redeals (the same tiles cannot satisfy both)");
    assert(algebra.evaluateAlgebraBoardForSettings(round, { ...settings, gradeBand: "6-8" }).playable === false,
        "I2: a band change redeals");
    assert(algebra.evaluateAlgebraBoardForSettings(null, settings).playable === false,
        "I2: no round never keeps");

    const reveal = algebra.getAlgebraReveal(round);
    const selectionCount = algebra.getSelectionCount(round);

    assert(reveal.display.length > 0 && reveal.selectedIndexes.length >= selectionCount,
        "I2: reveal returns a selection and an answer line");
    assert(algebra.checkAlgebraSelection(round, reveal.selectedIndexes.slice(0, selectionCount)).correct,
        "I2: the revealed selection is the solution");
}

/* ---------------- I3: shared-state ---------------- */

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
    const storage = {};
    const api = loadSharedState(storage);
    const state = api.getState();

    assert(state.settings.content === "arithmetic", "I3: default content is arithmetic");
    assert(state.settings.gradeBand === "k-2", "I3: default grade band is k-2");
    assert(state.settings.algebraSkill === "missing-number", "I3: default algebra skill is missing-number");
    assert(state.settings.solveSteps === "mixed", "I3: default solve steps is mixed");
    assert(state.algebraRound === null, "I3: default algebraRound is null");

    api.setContentInPlace("algebra");
    assert(state.settings.content === "algebra", "I3: setContentInPlace sets algebra");

    api.setGameMode(api.GAME_MODES.MAX_OUT);
    assert(state.gameMode === api.GAME_MODES.CLASSIC,
        "I3: flow modes are refused while content is algebra");

    api.setGradeBandInPlace("3-5");
    api.setAlgebraSkillInPlace("equivalent");
    assert(state.settings.algebraSkill === "missing-number",
        "I3: algebra skill clamps against the band (equivalent is 6-8 only)");

    api.setGradeBandInPlace("6-8");
    api.setAlgebraSkillInPlace("equivalent");
    assert(state.settings.algebraSkill === "equivalent",
        "I3: equivalent is allowed in 6-8");

    api.setSolveStepsInPlace("two-step");
    assert(state.settings.solveSteps === "two-step", "I3: solve steps setter stores two-step");
    api.setSolveStepsInPlace("bogus");
    assert(state.settings.solveSteps === "mixed", "I3: solve steps normalizes back to mixed");

    // Round trip: an algebra round survives save + fresh load.
    const round = algebra.createAlgebraExample("solve-two-step");

    state.algebraRound = round;
    state.puzzle = round.tiles.map(tile => tile.value);
    api.saveState({ reason: "test-algebra-round" });

    const reloaded = loadSharedState(storage).getState();

    assert(reloaded.settings.content === "algebra", "I3: content survives the round trip");
    assert(reloaded.settings.gradeBand === "6-8", "I3: grade band survives the round trip");
    assert(reloaded.algebraRound !== null, "I3: algebraRound survives the round trip");
    assert(reloaded.algebraRound.banner.text === "2x − 3 = 9",
        "I3: round banner survives the round trip");
    assert(
        JSON.stringify(reloaded.algebraRound.tiles.map(tile => tile.face)) ===
        JSON.stringify(["6", "3", "12", "4"]),
        "I3: round tile faces survive the round trip"
    );
    assert(reloaded.algebraRound.solution.indexes.join(",") === "0",
        "I3: round solution survives the round trip");

    // The legacy setOperation path runs the shared
    // resetPuzzleState, which must clear the round.
    const api2 = loadSharedState(storage);
    const state2 = api2.getState();

    assert(state2.algebraRound !== null, "I3: round present before the reset check");
    api2.setOperation("addition");
    assert(state2.algebraRound === null, "I3: puzzle reset clears the algebra round");
}

{
    // Legacy state (no algebra fields at all) loads as arithmetic.
    const storage = {};
    const api = loadSharedState(storage);
    const state = api.getState();

    api.replaceState({
        gameMode: "CLASSIC",
        settings: { operation: "division", allowNegatives: true },
        puzzle: [16, 6, 18, 3]
    }, "test-legacy");

    assert(state.settings.content === "arithmetic",
        "I3: a legacy state without algebra fields loads as arithmetic");
    assert(state.algebraRound === null,
        "I3: a legacy state loads with no algebra round");
    assert(state.settings.operation === "division",
        "I3: legacy settings are preserved");
}

/* ---------------- I4: source-level wiring ---------------- */

{
    const demoHtml = fs.readFileSync(`${BASE}/demo.html`, "utf8");
    const teacherHtml = fs.readFileSync(`${BASE}/teacher.html`, "utf8");
    const smartboardHtml = fs.readFileSync(`${BASE}/smartboard.html`, "utf8");
    const demoJs = fs.readFileSync(`${BASE}/js/demo.js`, "utf8");
    const teacherJs = fs.readFileSync(`${BASE}/js/teacher.js`, "utf8");
    const smartboardJs = fs.readFileSync(`${BASE}/js/smartboard.js`, "utf8");
    const sharedJs = fs.readFileSync(`${BASE}/js/shared-state.js`, "utf8");

    for (const [name, html] of [["demo", demoHtml], ["teacher", teacherHtml], ["smartboard", smartboardHtml]]) {
        assert(html.includes("js/algebra-engine.js"), `I4: ${name}.html loads the algebra engine`);
        assert(html.includes('id="algebra-banner"'), `I4: ${name}.html carries the algebra banner`);
    }

    for (const [name, html] of [["demo", demoHtml], ["teacher", teacherHtml]]) {
        assert(html.includes('id="content-algebra-button"'), `I4: ${name}.html carries the Content switch`);
        assert(html.includes('id="grade-band"'), `I4: ${name}.html carries the Grade Band control`);
        assert(html.includes('id="algebra-skill"'), `I4: ${name}.html carries the Skill control`);
        assert(html.includes('id="solve-steps"'), `I4: ${name}.html carries the Steps knob`);
    }

    assert(!smartboardHtml.includes('id="grade-band"') && !smartboardHtml.includes('id="algebra-skill"'),
        "I4: the Smart Board gains NO new controls");
    assert(demoJs.includes("createAlgebraPuzzle") && teacherJs.includes("createAlgebraPuzzle"),
        "I4: Demo and Teacher deal algebra rounds through the engine");
    assert(smartboardJs.includes("checkAlgebraSelection") && !smartboardJs.includes("createAlgebraPuzzle"),
        "I4: the Smart Board checks algebra selections but never deals rounds");
    assert(sharedJs.includes("setContentInPlace") && sharedJs.includes("setAlgebraSkillInPlace") &&
        sharedJs.includes("setGradeBandInPlace") && sharedJs.includes("setSolveStepsInPlace"),
        "I4: shared-state exports the algebra in-place setters");
}

/* ---------------- summary ---------------- */

console.log(`\nI algebra sweeps: ${sweptRounds} generated rounds verified`);
console.log(`${checks} checks, ${failures} failures`);

if (failures > 0) {
    process.exit(1);
}
