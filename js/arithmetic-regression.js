"use strict";

(function runArithmeticRegression() {
    const output = document.querySelector("#regression-output");
    const summary = document.querySelector("#regression-summary");
    const engine = window.OperationHuntArithmeticEngine;

    if (!output || !summary || !engine) {
        throw new Error("Arithmetic regression dependencies are missing.");
    }

    const results = [];

    function record(name, passed, details = "") {
        results.push({ name, passed, details });
    }

    function getConfigurations() {
        return [
            { gridSize: 2, terms: 2 },
            { gridSize: 3, terms: 2 },
            { gridSize: 3, terms: 3 },
            { gridSize: 4, terms: 2 },
            { gridSize: 4, terms: 3 },
            { gridSize: 4, terms: 4 },
            { gridSize: 5, terms: 2 },
            { gridSize: 5, terms: 3 },
            { gridSize: 5, terms: 4 }
        ];
    }

    function calculate(operation, values) {
        if (typeof engine.calculateResult === "function") {
            return engine.calculateResult(operation, values);
        }

        if (operation === engine.OPERATIONS.SUBTRACTION) {
            return values.slice(1).reduce(
                (difference, value) => difference - value,
                values[0]
            );
        }

        return values.reduce(
            (sum, value) => sum + value,
            0
        );
    }

    function hasExactDivisionSequence(values, resultValue) {
        if (!Array.isArray(values) || values.length < 2) {
            return false;
        }

        let currentValue = Number(values[0]);

        for (
            let index = 1;
            index < values.length;
            index += 1
        ) {
            const divisor = Number(values[index]);

            if (
                divisor === 0 ||
                !Number.isInteger(currentValue) ||
                currentValue % divisor !== 0
            ) {
                return false;
            }

            currentValue /= divisor;
        }

        return currentValue === resultValue;
    }

    function runConfiguration(operation, configuration) {
        const { gridSize, terms } = configuration;
        const boardSize = gridSize * gridSize;
        const minimum = 1;
        const maximum = Math.max(
            35,
            engine.getMinimumMaximumForPuzzle(
                operation,
                minimum,
                boardSize,
                terms
            ) + 10
        );

        const label =
            `${operation} ${gridSize}×${gridSize}, ${terms} terms`;

        try {
            const puzzle = engine.createPuzzle({
                operation,
                minimum,
                maximum,
                gridSize,
                requiredTerms: terms
            });

            const uniqueValues = new Set(puzzle.numbers);
            const combination = puzzle.combinations[0];
            const termValues = combination.termIndexes.map(
                index => puzzle.numbers[index]
            );

            record(
                `${label}: board size`,
                puzzle.numbers.length === boardSize,
                `${puzzle.numbers.length}/${boardSize}`
            );

            record(
                `${label}: unique values`,
                uniqueValues.size === boardSize,
                `${uniqueValues.size}/${boardSize}`
            );

            record(
                `${label}: valid combination exists`,
                Boolean(combination)
            );

            record(
                `${label}: equation is correct`,
                Boolean(combination) &&
                    calculate(operation, termValues) ===
                        combination.resultValue,
                combination?.equation || "No equation"
            );

            const found = engine.findComboForSelection(
                operation,
                puzzle.numbers,
                combination.termIndexes,
                terms,
                []
            );

            record(
                `${label}: selection lookup`,
                Boolean(found) &&
                    found.resultIndex === combination.resultIndex
            );

            const excluded = engine.findComboForSelection(
                operation,
                puzzle.numbers,
                combination.termIndexes,
                terms,
                combination.indexes
            );

            record(
                `${label}: used positions excluded`,
                excluded === null
            );

            if (operation === engine.OPERATIONS.SUBTRACTION) {
                const reversed = [
                    combination.termIndexes[1],
                    combination.termIndexes[0],
                    ...combination.termIndexes.slice(2)
                ];

                const wrongOrder = engine.findComboForSelection(
                    operation,
                    puzzle.numbers,
                    reversed,
                    terms,
                    []
                );

                record(
                    `${label}: starting number order enforced`,
                    wrongOrder === null
                );
            }

            if (operation === engine.OPERATIONS.MULTIPLICATION) {
                const reversedFactors = [
                    ...combination.termIndexes
                ].reverse();

                const reordered = engine.findComboForSelection(
                    operation,
                    puzzle.numbers,
                    reversedFactors,
                    terms,
                    []
                );

                record(
                    `${label}: factor order is flexible`,
                    Boolean(reordered) &&
                        reordered.resultIndex ===
                            combination.resultIndex
                );
            }

            if (operation === engine.OPERATIONS.DIVISION) {
                const wrongDividendOrder = [
                    combination.termIndexes[1],
                    combination.termIndexes[0],
                    ...combination.termIndexes.slice(2)
                ];

                const wrongDividend = engine.findComboForSelection(
                    operation,
                    puzzle.numbers,
                    wrongDividendOrder,
                    terms,
                    []
                );

                record(
                    `${label}: dividend order enforced`,
                    wrongDividend === null
                );

                const reorderedDivisors = [
                    combination.termIndexes[0],
                    ...combination.termIndexes.slice(1).reverse()
                ];

                const reordered = engine.findComboForSelection(
                    operation,
                    puzzle.numbers,
                    reorderedDivisors,
                    terms,
                    []
                );

                record(
                    `${label}: divisor order is flexible`,
                    Boolean(reordered) &&
                        reordered.resultIndex ===
                            combination.resultIndex
                );

                record(
                    `${label}: every division step is exact`,
                    hasExactDivisionSequence(
                        termValues,
                        combination.resultValue
                    ),
                    combination.equation
                );

                record(
                    `${label}: divide-by-zero protection`,
                    engine.calculateResult(
                        operation,
                        [termValues[0], 0]
                    ) === null
                );
            }
        } catch (error) {
            record(label, false, error.message);
        }
    }

    [
        engine.OPERATIONS.ADDITION,
        engine.OPERATIONS.SUBTRACTION,
        engine.OPERATIONS.MULTIPLICATION,
        engine.OPERATIONS.DIVISION
    ].forEach(operation => {
        getConfigurations().forEach(configuration => {
            runConfiguration(operation, configuration);
        });
    });

    const passedCount = results.filter(
        result => result.passed
    ).length;

    const failedCount = results.length - passedCount;

    summary.textContent = failedCount === 0
        ? `PASS — ${passedCount}/${results.length} checks passed.`
        : `FAIL — ${failedCount} of ${results.length} checks failed.`;

    summary.className = failedCount === 0
        ? "regression-summary pass"
        : "regression-summary fail";

    results.forEach(result => {
        const row = document.createElement("li");
        row.className = result.passed ? "pass" : "fail";

        const status = document.createElement("strong");
        status.textContent = result.passed ? "PASS" : "FAIL";

        const name = document.createElement("span");
        name.textContent = result.name;

        row.append(status, name);

        if (result.details) {
            const details = document.createElement("small");
            details.textContent = result.details;
            row.append(details);
        }

        output.append(row);
    });
})();
