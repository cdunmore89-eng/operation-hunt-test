"use strict";

(function extendArithmeticEngineWithMultiplication(global) {
    const baseEngine = global.OperationHuntArithmeticEngine;

    if (!baseEngine) {
        throw new Error(
            "OperationHuntArithmeticEngine must load before multiplication support."
        );
    }

    const MULTIPLICATION = "MULTIPLICATION";
    const MAX_FACTOR_GROUPS = 512;
    const FACTOR_SEARCH_WIDTH = 24;

    const OPERATIONS = Object.freeze({
        ...baseEngine.OPERATIONS,
        MULTIPLICATION
    });

    function normalizeOperation(operation) {
        return operation === MULTIPLICATION
            ? MULTIPLICATION
            : baseEngine.normalizeOperation(operation);
    }

    function normalizeExcludedIndexes(excludedIndexes) {
        return new Set(
            Array.isArray(excludedIndexes)
                ? excludedIndexes.filter(Number.isInteger)
                : []
        );
    }

    function randomInteger(minimum, maximum) {
        return Math.floor(
            Math.random() * (maximum - minimum + 1)
        ) + minimum;
    }

    function shuffle(values) {
        const shuffled = [...values];

        for (
            let index = shuffled.length - 1;
            index > 0;
            index -= 1
        ) {
            const randomIndex = randomInteger(0, index);

            [shuffled[index], shuffled[randomIndex]] =
                [shuffled[randomIndex], shuffled[index]];
        }

        return shuffled;
    }

    function getRangeValues(minimum, maximum) {
        const values = [];

        for (
            let value = minimum;
            value <= maximum;
            value += 1
        ) {
            values.push(value);
        }

        return values;
    }

    function collectIndexCombinations(
        availableIndexes,
        requiredCount,
        startIndex,
        currentIndexes,
        combinations
    ) {
        if (currentIndexes.length === requiredCount) {
            combinations.push([...currentIndexes]);
            return;
        }

        const needed = requiredCount - currentIndexes.length;

        for (
            let index = startIndex;
            index <= availableIndexes.length - needed;
            index += 1
        ) {
            currentIndexes.push(availableIndexes[index]);

            collectIndexCombinations(
                availableIndexes,
                requiredCount,
                index + 1,
                currentIndexes,
                combinations
            );

            currentIndexes.pop();
        }
    }

    function multiply(values) {
        return values.reduce(
            (product, value) => product * Number(value),
            1
        );
    }

    function getMinimumFactorSet(minimum, requiredTerms) {
        if (minimum === 1 && requiredTerms === 2) {
            return [2, 3];
        }

        return Array.from(
            { length: requiredTerms },
            (_, index) => minimum + index
        );
    }

    function getMinimumMaximumForMultiplication(
        minimum,
        boardSize,
        requiredTerms
    ) {
        const boardMaximum = minimum + boardSize - 1;
        const factorProduct = multiply(
            getMinimumFactorSet(minimum, requiredTerms)
        );

        if (!Number.isSafeInteger(factorProduct)) {
            throw new Error(
                "The selected multiplication range creates numbers that are too large."
            );
        }

        return Math.max(boardMaximum, factorProduct);
    }

    function buildMultiplicationRecord(
        numbers,
        termIndexes,
        resultIndex
    ) {
        const termValues = termIndexes.map(
            index => Number(numbers[index])
        );

        const resultValue = Number(numbers[resultIndex]);

        return {
            operation: MULTIPLICATION,
            termIndexes: [...termIndexes],
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
                `${termValues.join(" × ")} = ${resultValue}`
        };
    }

    function findMultiplicationCombinations(
        numbers,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        if (!Array.isArray(numbers)) {
            return [];
        }

        const excluded = normalizeExcludedIndexes(
            excludedIndexes
        );

        const availableIndexes = numbers
            .map((_, index) => index)
            .filter(index => !excluded.has(index));

        if (availableIndexes.length < requiredTerms + 1) {
            return [];
        }

        const indexByValue = new Map(
            availableIndexes.map(index => [
                Number(numbers[index]),
                index
            ])
        );

        const termGroups = [];

        collectIndexCombinations(
            availableIndexes,
            requiredTerms,
            0,
            [],
            termGroups
        );

        const combinations = [];

        termGroups.forEach(termIndexes => {
            const product = multiply(
                termIndexes.map(index => numbers[index])
            );

            if (!Number.isSafeInteger(product)) {
                return;
            }

            const resultIndex = indexByValue.get(product);

            if (
                resultIndex === undefined ||
                termIndexes.includes(resultIndex)
            ) {
                return;
            }

            combinations.push(
                buildMultiplicationRecord(
                    numbers,
                    termIndexes,
                    resultIndex
                )
            );
        });

        return combinations;
    }

    function findMultiplicationComboForSelection(
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

        const record = findMultiplicationCombinations(
            numbers,
            requiredTerms,
            excludedIndexes
        ).find(combination =>
            combination.termIndexes.every(
                index => selectedSet.has(index)
            )
        );

        return record
            ? buildMultiplicationRecord(
                numbers,
                [...selectedIndexes],
                record.resultIndex
            )
            : null;
    }

    function collectFactorGroups(
        minimum,
        maximum,
        requiredTerms
    ) {
        const candidateMaximum = Math.min(
            maximum,
            minimum + FACTOR_SEARCH_WIDTH
        );

        const candidates = getRangeValues(
            minimum,
            candidateMaximum
        );

        const groups = [];

        function search(startIndex, current, product) {
            if (groups.length >= MAX_FACTOR_GROUPS) {
                return;
            }

            if (current.length === requiredTerms) {
                if (
                    product <= maximum &&
                    !current.includes(product) &&
                    Number.isSafeInteger(product)
                ) {
                    groups.push([...current]);
                }

                return;
            }

            const needed = requiredTerms - current.length;

            for (
                let index = startIndex;
                index <= candidates.length - needed;
                index += 1
            ) {
                const value = candidates[index];
                const nextProduct = product * value;

                if (
                    !Number.isSafeInteger(nextProduct) ||
                    nextProduct > maximum
                ) {
                    continue;
                }

                current.push(value);
                search(index + 1, current, nextProduct);
                current.pop();

                if (groups.length >= MAX_FACTOR_GROUPS) {
                    return;
                }
            }
        }

        search(0, [], 1);

        return groups;
    }

    function createMultiplicationPuzzle(options = {}) {
        const minimum = Number(options.minimum);
        const maximum = Number(options.maximum);
        const gridSize = Number(options.gridSize);
        const requiredTerms = Number(
            options.requiredTerms || options.requiredAddends || 2
        );
        const boardSize = gridSize * gridSize;

        if (
            !Number.isInteger(minimum) ||
            !Number.isInteger(maximum) ||
            minimum < 1 ||
            maximum <= minimum
        ) {
            throw new Error(
                "Minimum and maximum must be whole numbers, " +
                "and maximum must be greater than minimum."
            );
        }

        if (
            ![2, 3, 4, 5].includes(gridSize) ||
            ![2, 3, 4].includes(requiredTerms)
        ) {
            throw new Error(
                "Multiplication requires a 2×2–5×5 grid and two–four terms."
            );
        }

        if (maximum - minimum + 1 < boardSize) {
            throw new Error(
                `This grid needs at least ${boardSize} unique numbers.`
            );
        }

        const requiredMaximum =
            getMinimumMaximumForMultiplication(
                minimum,
                boardSize,
                requiredTerms
            );

        if (maximum < requiredMaximum) {
            throw new Error(
                `${requiredTerms} multiplication terms starting at ` +
                `${minimum} need the maximum to be at least ` +
                `${requiredMaximum}.`
            );
        }

        const factorGroups = collectFactorGroups(
            minimum,
            maximum,
            requiredTerms
        );

        if (factorGroups.length === 0) {
            throw new Error(
                "A valid multiplication puzzle could not be generated. " +
                "Increase the maximum number range."
            );
        }

        const factors = factorGroups[
            randomInteger(0, factorGroups.length - 1)
        ];
        const product = multiply(factors);
        const numbers = [...factors, product];
        const usedNumbers = new Set(numbers);
        const distractors = shuffle(
            getRangeValues(minimum, maximum).filter(
                value => !usedNumbers.has(value)
            )
        );

        while (
            numbers.length < boardSize &&
            distractors.length > 0
        ) {
            numbers.push(distractors.pop());
        }

        if (numbers.length !== boardSize) {
            throw new Error(
                "The selected range does not contain enough unique numbers."
            );
        }

        const shuffledNumbers = shuffle(numbers);
        const combinations = findMultiplicationCombinations(
            shuffledNumbers,
            requiredTerms
        );

        if (combinations.length === 0) {
            throw new Error(
                "A valid multiplication puzzle could not be generated."
            );
        }

        return {
            operation: MULTIPLICATION,
            numbers: shuffledNumbers,
            triples: combinations,
            combinations,
            gridSize,
            boardSize,
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
        if (normalizeOperation(operation) === MULTIPLICATION) {
            return findMultiplicationCombinations(
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
        if (normalizeOperation(operation) === MULTIPLICATION) {
            return findMultiplicationComboForSelection(
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

    function createPuzzle(options = {}) {
        if (normalizeOperation(options.operation) === MULTIPLICATION) {
            return createMultiplicationPuzzle(options);
        }

        return baseEngine.createPuzzle(options);
    }

    function getMinimumMaximumForPuzzle(
        operation,
        minimum,
        boardSize,
        requiredTerms
    ) {
        if (normalizeOperation(operation) === MULTIPLICATION) {
            return getMinimumMaximumForMultiplication(
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
        if (normalizeOperation(operation) === MULTIPLICATION) {
            return Object.freeze({
                id: MULTIPLICATION,
                name: "Multiplication",
                symbol: "×",
                resultName: "product",
                runningLabel: "Show Running Product"
            });
        }

        const config = baseEngine.getOperationConfig(operation);

        return Object.freeze({
            ...config,
            runningLabel:
                config.id === baseEngine.OPERATIONS.SUBTRACTION
                    ? "Show Running Difference"
                    : "Show Running Sum"
        });
    }

    function calculateResult(operation, values) {
        if (!Array.isArray(values) || values.length === 0) {
            return null;
        }

        const normalizedOperation = normalizeOperation(operation);

        if (normalizedOperation === MULTIPLICATION) {
            return multiply(values);
        }

        if (
            normalizedOperation ===
            baseEngine.OPERATIONS.SUBTRACTION
        ) {
            return values.slice(1).reduce(
                (difference, value) =>
                    difference - Number(value),
                Number(values[0])
            );
        }

        return values.reduce(
            (sum, value) => sum + Number(value),
            0
        );
    }

    global.OperationHuntArithmeticEngine = Object.freeze({
        ...baseEngine,
        OPERATIONS,
        normalizeOperation,
        getOperationConfig,
        calculateResult,
        findCombinations,
        findMultiplicationCombinations,
        findComboForSelection,
        hasRemainingCombinations,
        createPuzzle,
        createMultiplicationPuzzle,
        getMinimumMaximumForPuzzle
    });
})(window);
