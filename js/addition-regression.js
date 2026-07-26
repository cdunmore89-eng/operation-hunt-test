"use strict";

(function runAdditionRegressionSuite() {
    const engine = window.OperationHuntPuzzleEngine;
    const resultsElement = document.querySelector("#regression-results");
    const summaryElement = document.querySelector("#regression-summary");

    if (!engine || !resultsElement || !summaryElement) {
        throw new Error("Addition regression suite could not initialize.");
    }

    const results = [];

    function record(name, passed, details = "") {
        results.push({ name, passed, details });
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    function runTest(name, test) {
        try {
            test();
            record(name, true);
        } catch (error) {
            record(
                name,
                false,
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    function validateCombination(numbers, combination, requiredAddends) {
        assert(
            combination.addendIndexes.length === requiredAddends,
            "Combination uses the wrong number of terms."
        );

        const uniqueIndexes = new Set(combination.indexes);

        assert(
            uniqueIndexes.size === requiredAddends + 1,
            "Combination reuses a board position."
        );

        const calculatedResult = combination.addendIndexes.reduce(
            (sum, index) => sum + numbers[index],
            0
        );

        assert(
            calculatedResult === numbers[combination.resultIndex],
            "Combination result does not equal its term sum."
        );

        const found = engine.findComboForSelection(
            numbers,
            combination.addendIndexes,
            requiredAddends
        );

        assert(
            Boolean(found),
            "A generated combination could not be found again."
        );
    }

    runTest("Allowed terms match each grid", () => {
        assert(
            JSON.stringify(engine.getAllowedRequiredAddends(2)) ===
                JSON.stringify([2]),
            "2×2 should allow two terms only."
        );
        assert(
            JSON.stringify(engine.getAllowedRequiredAddends(3)) ===
                JSON.stringify([2, 3]),
            "3×3 should allow two or three terms."
        );
        assert(
            JSON.stringify(engine.getAllowedRequiredAddends(4)) ===
                JSON.stringify([2, 3, 4]),
            "4×4 should allow two, three, or four terms."
        );
        assert(
            JSON.stringify(engine.getAllowedRequiredAddends(5)) ===
                JSON.stringify([2, 3, 4]),
            "5×5 should allow two, three, or four terms."
        );
    });

    runTest("Known two-term combinations are detected", () => {
        const numbers = [2, 3, 5, 8];
        const combinations = engine.findAdditionCombinations(
            numbers,
            2
        );

        assert(
            combinations.some(combo => combo.equation === "2 + 3 = 5"),
            "2 + 3 = 5 was not detected."
        );
        assert(
            combinations.some(combo => combo.equation === "3 + 5 = 8"),
            "3 + 5 = 8 was not detected."
        );
    });

    runTest("Used indexes are excluded from later strikes", () => {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const firstStrike = engine.findAdditionCombinations(
            numbers,
            2
        ).find(combo => combo.equation === "1 + 2 = 3");

        assert(Boolean(firstStrike), "The first strike was not found.");

        const remaining = engine.findAdditionCombinations(
            numbers,
            2,
            firstStrike.indexes
        );

        assert(
            remaining.every(combo =>
                combo.indexes.every(
                    index => !firstStrike.indexes.includes(index)
                )
            ),
            "A remaining combination reused a struck position."
        );

        assert(
            remaining.some(combo => combo.equation === "4 + 5 = 9"),
            "A valid disjoint strike was removed."
        );
    });

    const configurations = [
        { gridSize: 2, requiredAddends: 2 },
        { gridSize: 3, requiredAddends: 2 },
        { gridSize: 3, requiredAddends: 3 },
        { gridSize: 4, requiredAddends: 2 },
        { gridSize: 4, requiredAddends: 3 },
        { gridSize: 4, requiredAddends: 4 },
        { gridSize: 5, requiredAddends: 2 },
        { gridSize: 5, requiredAddends: 3 },
        { gridSize: 5, requiredAddends: 4 }
    ];

    configurations.forEach(configuration => {
        const label =
            `${configuration.gridSize}×${configuration.gridSize}, ` +
            `${configuration.requiredAddends} terms`;

        runTest(`Generated puzzles: ${label}`, () => {
            const boardSize =
                configuration.gridSize * configuration.gridSize;
            const minimum = 1;
            const maximum = Math.max(
                40,
                engine.getMinimumMaximumForPuzzle(
                    minimum,
                    boardSize,
                    configuration.requiredAddends
                ) + 10
            );

            for (let sample = 0; sample < 5; sample += 1) {
                const puzzle = engine.createNumberPuzzle({
                    minimum,
                    maximum,
                    gridSize: configuration.gridSize,
                    requiredAddends: configuration.requiredAddends
                });

                assert(
                    puzzle.numbers.length === boardSize,
                    "Generated board has the wrong number of tiles."
                );
                assert(
                    new Set(puzzle.numbers).size === boardSize,
                    "Generated board contains duplicate numbers."
                );
                assert(
                    puzzle.numbers.every(
                        value => value >= minimum && value <= maximum
                    ),
                    "Generated board contains an out-of-range value."
                );
                assert(
                    puzzle.combinations.length > 0,
                    "Generated board has no valid combination."
                );

                puzzle.combinations.forEach(combination => {
                    validateCombination(
                        puzzle.numbers,
                        combination,
                        configuration.requiredAddends
                    );
                });
            }
        });
    });

    const passedCount = results.filter(result => result.passed).length;
    const failedCount = results.length - passedCount;

    summaryElement.textContent =
        failedCount === 0
            ? `PASS — ${passedCount}/${results.length} checks passed.`
            : `FAIL — ${failedCount} of ${results.length} checks failed.`;

    summaryElement.className =
        failedCount === 0
            ? "regression-summary pass"
            : "regression-summary fail";

    results.forEach(result => {
        const item = document.createElement("li");
        item.className = result.passed ? "pass" : "fail";

        const title = document.createElement("strong");
        title.textContent =
            `${result.passed ? "PASS" : "FAIL"} — ${result.name}`;

        item.append(title);

        if (result.details) {
            const details = document.createElement("p");
            details.textContent = result.details;
            item.append(details);
        }

        resultsElement.append(item);
    });
})();
