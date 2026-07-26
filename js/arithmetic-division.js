"use strict";

(function extendArithmeticEngineWithDivision(global) {
    const baseEngine = global.OperationHuntArithmeticEngine;

    if (!baseEngine) {
        throw new Error(
            "OperationHuntArithmeticEngine must load before division support."
        );
    }

    const DIVISION = "DIVISION";
    const MULTIPLICATION =
        baseEngine.OPERATIONS.MULTIPLICATION;

    if (
        !MULTIPLICATION ||
        typeof baseEngine.findMultiplicationCombinations !== "function" ||
        typeof baseEngine.createMultiplicationPuzzle !== "function"
    ) {
        throw new Error(
            "Multiplication support must load before division support."
        );
    }

    const OPERATIONS = Object.freeze({
        ...baseEngine.OPERATIONS,
        DIVISION
    });

    function normalizeOperation(operation) {
        return operation === DIVISION
            ? DIVISION
            : baseEngine.normalizeOperation(operation);
    }

    function buildDivisionRecord(
        numbers,
        dividendIndex,
        divisorIndexes,
        resultIndex
    ) {
        const termIndexes = [
            dividendIndex,
            ...divisorIndexes
        ];

        const termValues = termIndexes.map(
            index => Number(numbers[index])
        );

        const resultValue = Number(numbers[resultIndex]);

        return {
            operation: DIVISION,
            termIndexes,
            operandIndexes: [...termIndexes],
            addendIndexes: [...termIndexes],
            resultIndex,
            termValues,
            operandValues: [...termValues],
            addendValues: [...termValues],
            resultValue,
            indexes: [...termIndexes, resultIndex],
            firstIndex: termIndexes[0],
            secondIndex: termIndexes[1],
            firstValue: termValues[0],
            secondValue: termValues[1],
            equation:
                `${termValues.join(" ÷ ")} = ${resultValue}`
        };
    }

    function findDivisionCombinations(
        numbers,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        if (!Array.isArray(numbers)) {
            return [];
        }

        const multiplicationCombinations =
            baseEngine.findMultiplicationCombinations(
                numbers,
                requiredTerms,
                excludedIndexes
            );

        const combinations = [];
        const combinationKeys = new Set();

        multiplicationCombinations.forEach(record => {
            const factorIndexes = [
                ...(record.termIndexes || record.addendIndexes || [])
            ];

            const dividendIndex = record.resultIndex;

            factorIndexes.forEach(resultIndex => {
                const divisorIndexes = factorIndexes.filter(
                    index => index !== resultIndex
                );

                const hasZeroDivisor = divisorIndexes.some(
                    index => Number(numbers[index]) === 0
                );

                if (
                    hasZeroDivisor ||
                    dividendIndex === resultIndex ||
                    divisorIndexes.length !== requiredTerms - 1
                ) {
                    return;
                }

                const key = [
                    dividendIndex,
                    [...divisorIndexes].sort((a, b) => a - b).join(","),
                    resultIndex
                ].join("|");

                if (combinationKeys.has(key)) {
                    return;
                }

                combinationKeys.add(key);
                combinations.push(
                    buildDivisionRecord(
                        numbers,
                        dividendIndex,
                        divisorIndexes,
                        resultIndex
                    )
                );
            });
        });

        return combinations;
    }

    function findDivisionComboForSelection(
        numbers,
        selectedIndexes,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        if (
            !Array.isArray(selectedIndexes) ||
            selectedIndexes.length !== requiredTerms
        ) {
            return null;
        }

        const selectedSet = new Set(selectedIndexes);

        if (selectedSet.size !== requiredTerms) {
            return null;
        }

        const dividendIndex = selectedIndexes[0];
        const selectedDivisors = new Set(
            selectedIndexes.slice(1)
        );

        const matchingRecord = findDivisionCombinations(
            numbers,
            requiredTerms,
            excludedIndexes
        ).find(record => {
            if (record.termIndexes[0] !== dividendIndex) {
                return false;
            }

            const recordDivisors = record.termIndexes.slice(1);

            return (
                recordDivisors.length === selectedDivisors.size &&
                recordDivisors.every(
                    index => selectedDivisors.has(index)
                )
            );
        });

        if (!matchingRecord) {
            return null;
        }

        return buildDivisionRecord(
            numbers,
            dividendIndex,
            selectedIndexes.slice(1),
            matchingRecord.resultIndex
        );
    }

    function hasRemainingCombinations(
        operation,
        numbers,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        return findCombinations(
            operation,
            numbers,
            requiredTerms,
            excludedIndexes
        ).length > 0;
    }

    function createDivisionPuzzle(options = {}) {
        const requiredTerms = Number(
            options.requiredTerms || options.requiredAddends || 2
        );

        const generated = baseEngine.createMultiplicationPuzzle({
            ...options,
            operation: MULTIPLICATION,
            requiredTerms
        });

        const combinations = findDivisionCombinations(
            generated.numbers,
            requiredTerms
        );

        if (combinations.length === 0) {
            throw new Error(
                "A valid whole-number division puzzle could not be generated."
            );
        }

        return {
            ...generated,
            operation: DIVISION,
            triples: combinations,
            combinations,
            requiredAddends: requiredTerms,
            requiredTerms
        };
    }

    function findCombinations(
        operation,
        numbers,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        if (normalizeOperation(operation) === DIVISION) {
            return findDivisionCombinations(
                numbers,
                requiredTerms,
                excludedIndexes
            );
        }

        return baseEngine.findCombinations(
            operation,
            numbers,
            requiredTerms,
            excludedIndexes
        );
    }

    function findComboForSelection(
        operation,
        numbers,
        selectedIndexes,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        if (normalizeOperation(operation) === DIVISION) {
            return findDivisionComboForSelection(
                numbers,
                selectedIndexes,
                requiredTerms,
                excludedIndexes
            );
        }

        return baseEngine.findComboForSelection(
            operation,
            numbers,
            selectedIndexes,
            requiredTerms,
            excludedIndexes
        );
    }

    function createPuzzle(options = {}) {
        if (normalizeOperation(options.operation) === DIVISION) {
            return createDivisionPuzzle(options);
        }

        return baseEngine.createPuzzle(options);
    }

    function getMinimumMaximumForPuzzle(
        operation,
        minimum,
        boardSize,
        requiredTerms
    ) {
        if (normalizeOperation(operation) === DIVISION) {
            return baseEngine.getMinimumMaximumForPuzzle(
                MULTIPLICATION,
                minimum,
                boardSize,
                requiredTerms
            );
        }

        return baseEngine.getMinimumMaximumForPuzzle(
            operation,
            minimum,
            boardSize,
            requiredTerms
        );
    }

    function getOperationConfig(operation) {
        if (normalizeOperation(operation) === DIVISION) {
            return Object.freeze({
                id: DIVISION,
                name: "Division",
                symbol: "÷",
                resultName: "quotient",
                runningLabel: "Show Running Quotient"
            });
        }

        return baseEngine.getOperationConfig(operation);
    }

    function calculateResult(operation, values) {
        if (normalizeOperation(operation) !== DIVISION) {
            return baseEngine.calculateResult(operation, values);
        }

        if (!Array.isArray(values) || values.length === 0) {
            return null;
        }

        let quotient = Number(values[0]);

        for (
            let index = 1;
            index < values.length;
            index += 1
        ) {
            const divisor = Number(values[index]);

            if (divisor === 0 || !Number.isFinite(divisor)) {
                return null;
            }

            quotient /= divisor;

            if (!Number.isFinite(quotient)) {
                return null;
            }
        }

        return Number.isInteger(quotient)
            ? quotient
            : Number(quotient.toFixed(4));
    }

    global.OperationHuntArithmeticEngine = Object.freeze({
        ...baseEngine,
        OPERATIONS,
        normalizeOperation,
        getOperationConfig,
        calculateResult,
        findCombinations,
        findDivisionCombinations,
        findComboForSelection,
        hasRemainingCombinations,
        createPuzzle,
        createDivisionPuzzle,
        getMinimumMaximumForPuzzle
    });
})(window);
