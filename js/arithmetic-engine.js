"use strict";

(function createArithmeticEngine(global) {
    const additionEngine = global.OperationHuntPuzzleEngine;

    if (!additionEngine) {
        throw new Error(
            "OperationHuntPuzzleEngine must load before the arithmetic engine."
        );
    }

    const OPERATIONS = Object.freeze({
        ADDITION: "ADDITION",
        SUBTRACTION: "SUBTRACTION"
    });

    const MAX_GENERATION_ATTEMPTS = 20000;

    function normalizeOperation(operation) {
        return operation === OPERATIONS.SUBTRACTION
            ? OPERATIONS.SUBTRACTION
            : OPERATIONS.ADDITION;
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

    function normalizeExcludedIndexes(excludedIndexes) {
        return new Set(
            Array.isArray(excludedIndexes)
                ? excludedIndexes.filter(Number.isInteger)
                : []
        );
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

    function normalizeAdditionRecord(record) {
        const termIndexes = [
            ...(record.termIndexes ||
                record.operandIndexes ||
                record.addendIndexes || [])
        ];

        const termValues = [
            ...(record.termValues ||
                record.operandValues ||
                record.addendValues || [])
        ];

        return {
            ...record,
            operation: OPERATIONS.ADDITION,
            termIndexes,
            operandIndexes: termIndexes,
            addendIndexes: termIndexes,
            termValues,
            operandValues: termValues,
            addendValues: termValues
        };
    }

    function buildSubtractionRecord(
        numbers,
        termIndexes,
        resultIndex
    ) {
        const termValues = termIndexes.map(
            index => numbers[index]
        );

        const resultValue = numbers[resultIndex];

        return {
            operation: OPERATIONS.SUBTRACTION,
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
                `${termValues.join(" − ")} = ${resultValue}`
        };
    }

    function findSubtractionCombinations(
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

        const combinations = [];

        availableIndexes.forEach(minuendIndex => {
            const possibleSubtrahends = availableIndexes.filter(
                index => index !== minuendIndex
            );

            const subtrahendGroups = [];

            collectIndexCombinations(
                possibleSubtrahends,
                requiredTerms - 1,
                0,
                [],
                subtrahendGroups
            );

            subtrahendGroups.forEach(subtrahendIndexes => {
                const termIndexSet = new Set([
                    minuendIndex,
                    ...subtrahendIndexes
                ]);

                const difference = subtrahendIndexes.reduce(
                    (current, index) =>
                        current - Number(numbers[index]),
                    Number(numbers[minuendIndex])
                );

                availableIndexes.forEach(resultIndex => {
                    if (termIndexSet.has(resultIndex)) {
                        return;
                    }

                    if (Number(numbers[resultIndex]) !== difference) {
                        return;
                    }

                    combinations.push(
                        buildSubtractionRecord(
                            numbers,
                            [minuendIndex, ...subtrahendIndexes],
                            resultIndex
                        )
                    );
                });
            });
        });

        return combinations;
    }

    function findCombinations(
        operation,
        numbers,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        const normalizedOperation = normalizeOperation(operation);

        if (normalizedOperation === OPERATIONS.SUBTRACTION) {
            return findSubtractionCombinations(
                numbers,
                requiredTerms,
                excludedIndexes
            );
        }

        return additionEngine
            .findAdditionCombinations(
                numbers,
                requiredTerms,
                excludedIndexes
            )
            .map(normalizeAdditionRecord);
    }

    function findComboForSelection(
        operation,
        numbers,
        selectedIndexes,
        requiredTerms = 2,
        excludedIndexes = []
    ) {
        const normalizedOperation = normalizeOperation(operation);

        if (normalizedOperation === OPERATIONS.ADDITION) {
            const record = additionEngine.findComboForSelection(
                numbers,
                selectedIndexes,
                requiredTerms,
                excludedIndexes
            );

            return record
                ? normalizeAdditionRecord(record)
                : null;
        }

        if (
            !Array.isArray(selectedIndexes) ||
            selectedIndexes.length !== requiredTerms
        ) {
            return null;
        }

        const firstSelectedIndex = selectedIndexes[0];
        const selectedSubtrahends = new Set(
            selectedIndexes.slice(1)
        );

        const matchingRecord = findSubtractionCombinations(
            numbers,
            requiredTerms,
            excludedIndexes
        ).find(record => {
            if (record.termIndexes[0] !== firstSelectedIndex) {
                return false;
            }

            const recordSubtrahends = record.termIndexes.slice(1);

            return (
                recordSubtrahends.length === selectedSubtrahends.size &&
                recordSubtrahends.every(
                    index => selectedSubtrahends.has(index)
                )
            );
        });

        return matchingRecord
            ? buildSubtractionRecord(
                numbers,
                [...selectedIndexes],
                matchingRecord.resultIndex
            )
            : null;
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

    function chooseSubtractionTerms(
        minimum,
        maximum,
        requiredTerms
    ) {
        const values = getRangeValues(minimum, maximum);

        for (
            let attempt = 0;
            attempt < MAX_GENERATION_ATTEMPTS;
            attempt += 1
        ) {
            const selectedParts = shuffle(values)
                .slice(0, requiredTerms);

            const result = selectedParts[0];
            const subtrahends = selectedParts.slice(1);
            const minuend = selectedParts.reduce(
                (total, value) => total + value,
                0
            );

            if (
                minuend <= maximum &&
                !selectedParts.includes(minuend)
            ) {
                return {
                    minuend,
                    subtrahends,
                    result
                };
            }
        }

        const selectedParts = values.slice(0, requiredTerms);
        const minuend = selectedParts.reduce(
            (total, value) => total + value,
            0
        );

        if (
            selectedParts.length === requiredTerms &&
            minuend <= maximum &&
            !selectedParts.includes(minuend)
        ) {
            return {
                minuend,
                subtrahends: selectedParts.slice(1),
                result: selectedParts[0]
            };
        }

        return null;
    }

    function createSubtractionPuzzle(options = {}) {
        const minimum = Number(options.minimum);
        const maximum = Number(options.maximum);
        const gridSize = Number(options.gridSize);
        const requiredTerms = Number(options.requiredTerms);
        const boardSize = gridSize * gridSize;

        const requiredMaximum =
            additionEngine.getMinimumMaximumForPuzzle(
                minimum,
                boardSize,
                requiredTerms
            );

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

        if (maximum - minimum + 1 < boardSize) {
            throw new Error(
                `This grid needs at least ${boardSize} unique numbers.`
            );
        }

        if (maximum < requiredMaximum) {
            throw new Error(
                `${requiredTerms} terms starting at ${minimum} ` +
                `need the maximum to be at least ${requiredMaximum}.`
            );
        }

        for (
            let attempt = 0;
            attempt < MAX_GENERATION_ATTEMPTS;
            attempt += 1
        ) {
            const base = chooseSubtractionTerms(
                minimum,
                maximum,
                requiredTerms
            );

            if (!base) {
                break;
            }

            const numbers = [
                base.minuend,
                ...base.subtrahends,
                base.result
            ];

            const usedNumbers = new Set(numbers);
            const remainingValues = shuffle(
                getRangeValues(minimum, maximum).filter(
                    value => !usedNumbers.has(value)
                )
            );

            while (
                numbers.length < boardSize &&
                remainingValues.length > 0
            ) {
                numbers.push(remainingValues.pop());
            }

            if (numbers.length !== boardSize) {
                continue;
            }

            const shuffledNumbers = shuffle(numbers);
            const combinations = findSubtractionCombinations(
                shuffledNumbers,
                requiredTerms
            );

            if (combinations.length === 0) {
                continue;
            }

            return {
                operation: OPERATIONS.SUBTRACTION,
                numbers: shuffledNumbers,
                triples: combinations,
                combinations,
                gridSize,
                boardSize,
                requiredAddends: requiredTerms,
                requiredTerms
            };
        }

        throw new Error(
            "A valid subtraction puzzle could not be generated. " +
            "Increase the maximum number range."
        );
    }

    function createPuzzle(options = {}) {
        const operation = normalizeOperation(options.operation);
        const requiredTerms = Number(
            options.requiredTerms || options.requiredAddends || 2
        );

        if (operation === OPERATIONS.SUBTRACTION) {
            return createSubtractionPuzzle({
                ...options,
                requiredTerms
            });
        }

        const generated = additionEngine.createNumberPuzzle({
            minimum: options.minimum,
            maximum: options.maximum,
            gridSize: options.gridSize,
            requiredAddends: requiredTerms
        });

        const combinations = (
            generated.combinations || generated.triples || []
        ).map(normalizeAdditionRecord);

        return {
            ...generated,
            operation: OPERATIONS.ADDITION,
            triples: combinations,
            combinations,
            requiredTerms
        };
    }

    function getMinimumMaximumForPuzzle(
        operation,
        minimum,
        boardSize,
        requiredTerms
    ) {
        normalizeOperation(operation);

        return additionEngine.getMinimumMaximumForPuzzle(
            minimum,
            boardSize,
            requiredTerms
        );
    }

    function getOperationConfig(operation) {
        const normalizedOperation = normalizeOperation(operation);

        if (normalizedOperation === OPERATIONS.SUBTRACTION) {
            return Object.freeze({
                id: OPERATIONS.SUBTRACTION,
                name: "Subtraction",
                symbol: "−",
                resultName: "difference"
            });
        }

        return Object.freeze({
            id: OPERATIONS.ADDITION,
            name: "Addition",
            symbol: "+",
            resultName: "sum"
        });
    }

    global.OperationHuntArithmeticEngine = Object.freeze({
        OPERATIONS,
        normalizeOperation,
        getOperationConfig,
        findCombinations,
        findSubtractionCombinations,
        findComboForSelection,
        hasRemainingCombinations,
        createPuzzle,
        createSubtractionPuzzle,
        getMinimumMaximumForPuzzle
    });
})(window);
