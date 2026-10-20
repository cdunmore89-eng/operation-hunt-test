"use strict";

/*
Operation Hunt — multi-operation engine tests.
Run: node ~/workspace/operation-hunt/test-multi-op.js
Loads the WORKING COPY engine (multi-op) with window stubbed.
*/

global.window = global;
require(
    "/home/hatch/workspace/operation-hunt/multi-op/js/puzzle-engine.js"
);

const engine = global.OperationHuntPuzzleEngine;

let failures = 0;
let checks = 0;

function assert(condition, message) {
    checks += 1;

    if (!condition) {
        failures += 1;
        console.error(`FAIL: ${message}`);
    }
}

function verifyPuzzle(puzzle, options, label) {
    const {
        minimum,
        maximum,
        operation
    } = options;

    assert(
        new Set(puzzle.numbers).size ===
            puzzle.numbers.length,
        `${label}: values not unique: ${puzzle.numbers}`
    );

    assert(
        puzzle.numbers.every(
            value =>
                Number.isInteger(value) &&
                value >= minimum &&
                value <= maximum
        ),
        `${label}: value out of range: ${puzzle.numbers}`
    );

    const combos = engine.findCombinations(
        puzzle.numbers,
        puzzle.requiredAddends,
        [],
        operation
    );

    assert(
        combos.length >= 1,
        `${label}: no valid combo for ${operation} on ${puzzle.numbers}`
    );

    for (const combo of combos) {
        const folded = engine.computeResult(
            combo.operandValues,
            operation
        );

        assert(
            folded === combo.resultValue,
            `${label}: combo equation not arithmetically correct: ${combo.equation}`
        );

        const expectedEquation =
            `${combo.operandValues.join(` ${combo.symbol} `)} = ${combo.resultValue}`;

        assert(
            combo.equation === expectedEquation,
            `${label}: equation string mismatch: "${combo.equation}" vs "${expectedEquation}"`
        );
    }

    return combos;
}

const OPERATIONS = [
    "addition",
    "subtraction",
    "multiplication",
    "division"
];

/*
====================================================
A. Defaults per operation: min 1, max 20, 2x2, 2 terms
====================================================
*/
const A_COUNT = 5000;

for (const operation of OPERATIONS) {
    for (let i = 0; i < A_COUNT; i += 1) {
        const puzzle = engine.createNumberPuzzle({
            minimum: 1,
            maximum: 20,
            gridSize: 2,
            requiredAddends: 2,
            operation
        });

        verifyPuzzle(
            puzzle,
            { minimum: 1, maximum: 20, operation },
            `A/${operation}`
        );
    }

    console.log(
        `A ${operation}: ${A_COUNT} puzzles generated and verified`
    );
}

/*
====================================================
B. Click order counts (subtraction / division)
====================================================
*/
const divisionBoard = [12, 3, 4, 7];

const divForward = engine.findComboForOperation(
    divisionBoard, [0, 1], 2, [], "division"
);
assert(
    divForward && divForward.equation === "12 ÷ 3 = 4",
    `B: division [12,3] should match "12 ÷ 3 = 4", got ${divForward && divForward.equation}`
);

const divReversed = engine.findComboForOperation(
    divisionBoard, [1, 0], 2, [], "division"
);
assert(
    divReversed === null,
    `B: division [3,12] must return null, got ${divReversed && divReversed.equation}`
);

const divWrong = engine.findComboForOperation(
    divisionBoard, [0, 3], 2, [], "division"
);
assert(
    divWrong === null,
    "B: division wrong pair [12,7] must return null"
);

const subtractionBoard = [12, 3, 9, 5];

const subForward = engine.findComboForOperation(
    subtractionBoard, [0, 1], 2, [], "subtraction"
);
assert(
    subForward && subForward.equation === "12 − 3 = 9",
    `B: subtraction [12,3] should match "12 − 3 = 9", got ${subForward && subForward.equation}`
);

const subReversed = engine.findComboForOperation(
    subtractionBoard, [1, 0], 2, [], "subtraction"
);
assert(
    subReversed === null,
    `B: subtraction [3,12] with negatives off must return null, got ${subReversed && subReversed.equation}`
);

// With a negative tile actually on the board, the
// reversed order is a legitimate strike.
const negativeBoard = [3, 12, -9, 5];

const subNegative = engine.findComboForOperation(
    negativeBoard, [0, 1], 2, [], "subtraction"
);
assert(
    subNegative && subNegative.equation === "3 − 12 = -9",
    `B: subtraction [3,12] on a board containing -9 should match "3 − 12 = -9", got ${subNegative && subNegative.equation}`
);

// Commutative ops: any click order scores, and the
// displayed equation follows the click order.
const addClickOrder = engine.findComboForOperation(
    [2, 3, 5, 8], [1, 0], 2, [], "addition"
);
assert(
    addClickOrder && addClickOrder.equation === "3 + 2 = 5",
    `B: addition clicked [3,2] should display "3 + 2 = 5", got ${addClickOrder && addClickOrder.equation}`
);

const mulClickOrder = engine.findComboForOperation(
    [2, 3, 6, 8], [1, 0], 2, [], "multiplication"
);
assert(
    mulClickOrder && mulClickOrder.equation === "3 × 2 = 6",
    `B: multiplication clicked [3,2] should display "3 × 2 = 6", got ${mulClickOrder && mulClickOrder.equation}`
);

console.log("B click-order assertions done");

/*
====================================================
C. Addition backward compatibility
====================================================
*/
const legacy = engine.findComboForSelection(
    [2, 3, 5, 8], [0, 1], 2, []
);
assert(
    legacy && legacy.equation === "2 + 3 = 5",
    `C: legacy findComboForSelection should give "2 + 3 = 5", got ${legacy && legacy.equation}`
);

assert(
    engine.findAdditionCombinations([2, 3, 5, 8], 2, [])
        .length >= 1,
    "C: findAdditionCombinations should still work"
);

const four = engine.createFourNumberPuzzle(1, 20);
assert(
    four.numbers.length === 4 &&
        engine.findAdditionCombinations(four.numbers, 2, [])
            .length >= 1,
    "C: createFourNumberPuzzle should still produce a solvable addition board"
);

assert(
    engine.getMinimumMaximumForPuzzle(1, 4, 2) ===
        engine.getMinimumMaximumForOperation(
            1, 4, 2, "addition"
        ),
    "C: getMinimumMaximumForPuzzle should delegate to addition"
);

console.log("C legacy addition assertions done");

/*
====================================================
D. Negatives ON: min -10 max 20 (2,000/op) and
   min -5 max 10 feasibility (500/op)
====================================================
*/
const D_COUNT = 2000;
let subtractionNegativeFeatureCount = 0;
let subtractionNegativeTileCount = 0;

for (const operation of OPERATIONS) {
    for (let i = 0; i < D_COUNT; i += 1) {
        const puzzle = engine.createNumberPuzzle({
            minimum: -10,
            maximum: 20,
            gridSize: 2,
            requiredAddends: 2,
            operation,
            allowNegatives: true
        });

        const combos = verifyPuzzle(
            puzzle,
            { minimum: -10, maximum: 20, operation },
            `D/${operation}`
        );

        if (operation === "subtraction") {
            const primary = combos[0];

            if (
                primary.operandValues.some(v => v < 0) ||
                primary.resultValue < 0
            ) {
                subtractionNegativeFeatureCount += 1;
            }

            if (puzzle.numbers.some(v => v < 0)) {
                subtractionNegativeTileCount += 1;
            }
        }
    }

    console.log(
        `D ${operation}: ${D_COUNT} negatives-on puzzles (min -10, max 20) generated and verified`
    );
}

console.log(
    `D subtraction feature proof: ${subtractionNegativeFeatureCount}/${D_COUNT} generated subtraction puzzles have a solution using a negative operand or a negative result; ${subtractionNegativeTileCount}/${D_COUNT} contain at least one negative tile`
);

assert(
    subtractionNegativeFeatureCount > 0,
    "D: negatives feature never produced a negative operand/result for subtraction"
);

const D2_COUNT = 500;

for (const operation of OPERATIONS) {
    for (let i = 0; i < D2_COUNT; i += 1) {
        const puzzle = engine.createNumberPuzzle({
            minimum: -5,
            maximum: 10,
            gridSize: 2,
            requiredAddends: 2,
            operation,
            allowNegatives: true
        });

        verifyPuzzle(
            puzzle,
            { minimum: -5, maximum: 10, operation },
            `D2/${operation}`
        );
    }

    console.log(
        `D2 ${operation}: ${D2_COUNT} negatives-on puzzles (min -5, max 10) generated and verified`
    );
}

// Floor enforcement: -21 must be rejected, and a
// negative minimum must be rejected while the switch
// is off.
let floorRejected = false;
try {
    engine.createNumberPuzzle({
        minimum: -21,
        maximum: 20,
        gridSize: 2,
        requiredAddends: 2,
        allowNegatives: true
    });
} catch (error) {
    floorRejected = true;
}
assert(
    floorRejected,
    "D: minimum -21 with negatives on should be rejected (floor -20)"
);

let offRejected = false;
try {
    engine.createNumberPuzzle({
        minimum: -5,
        maximum: 20,
        gridSize: 2,
        requiredAddends: 2
    });
} catch (error) {
    offRejected = true;
}
assert(
    offRejected,
    "D: negative minimum with negatives off should be rejected"
);

console.log("D floor assertions done");

/*
====================================================
E. Bigger boards, all operations, 2 terms, 500 each.
   3x3 and 4x4 at min 1 max 20. A 5x5 board needs 25
   unique tiles, which cannot fit in [1,20], so 5x5
   is tested at max 30 (the demo raises the max the
   same way via enforceNumberRangeForGrid).
====================================================
*/
const E_COUNT = 500;
const GRID_CASES = [
    { gridSize: 3, maximum: 20 },
    { gridSize: 4, maximum: 20 },
    { gridSize: 5, maximum: 30 }
];

for (const operation of OPERATIONS) {
    for (const { gridSize, maximum } of GRID_CASES) {
        for (let i = 0; i < E_COUNT; i += 1) {
            const puzzle = engine.createNumberPuzzle({
                minimum: 1,
                maximum,
                gridSize,
                requiredAddends: 2,
                operation
            });

            assert(
                puzzle.numbers.length ===
                    gridSize * gridSize,
                `E/${operation}/${gridSize}x${gridSize}: expected ${gridSize * gridSize} tiles, got ${puzzle.numbers.length}`
            );

            verifyPuzzle(
                puzzle,
                { minimum: 1, maximum, operation },
                `E/${operation}/${gridSize}x${gridSize}`
            );
        }

        console.log(
            `E ${operation} ${gridSize}x${gridSize} (max ${maximum}): ${E_COUNT} puzzles generated and verified`
        );
    }
}

// And 5x5 at max 20 must fail cleanly (25 unique
// tiles cannot come from 20 values).
let fiveByFiveRejected = false;
try {
    engine.createNumberPuzzle({
        minimum: 1,
        maximum: 20,
        gridSize: 5,
        requiredAddends: 2,
        operation: "addition"
    });
} catch (error) {
    fiveByFiveRejected = true;
}
assert(
    fiveByFiveRejected,
    "E: 5x5 at min 1 max 20 should be rejected (needs 25 unique values)"
);

console.log("E grid assertions done");

/*
====================================================
F. Multi-term: addition 3-4 terms intact; subtraction
   and division left-fold generation at 3 terms with
   a feasible maximum.
====================================================
*/
const F_COUNT = 300;

for (let i = 0; i < F_COUNT; i += 1) {
    const p3 = engine.createNumberPuzzle({
        minimum: 1,
        maximum: 20,
        gridSize: 3,
        requiredAddends: 3,
        operation: "addition"
    });
    verifyPuzzle(
        p3,
        { minimum: 1, maximum: 20, operation: "addition" },
        "F/addition-terms3"
    );

    const p4 = engine.createNumberPuzzle({
        minimum: 1,
        maximum: 30,
        gridSize: 4,
        requiredAddends: 4,
        operation: "addition"
    });
    verifyPuzzle(
        p4,
        { minimum: 1, maximum: 30, operation: "addition" },
        "F/addition-terms4"
    );

    const s3 = engine.createNumberPuzzle({
        minimum: 1,
        maximum: 60,
        gridSize: 4,
        requiredAddends: 3,
        operation: "subtraction"
    });
    verifyPuzzle(
        s3,
        { minimum: 1, maximum: 60, operation: "subtraction" },
        "F/subtraction-terms3"
    );

    const d3 = engine.createNumberPuzzle({
        minimum: 1,
        maximum: 60,
        gridSize: 4,
        requiredAddends: 3,
        operation: "division"
    });
    verifyPuzzle(
        d3,
        { minimum: 1, maximum: 60, operation: "division" },
        "F/division-terms3"
    );
}

console.log(
    `F multi-term: ${F_COUNT} puzzles each for addition terms 3, addition terms 4, subtraction terms 3, division terms 3 — generated and verified`
);

console.log(
    `\n${checks} checks, ${failures} failures`
);

process.exit(failures > 0 ? 1 : 0);
