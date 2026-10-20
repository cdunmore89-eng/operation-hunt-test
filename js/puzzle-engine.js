"use strict";

(function createPuzzleEngine(global) {
    const DEFAULT_BOARD_SIZE = 4;
    const MIN_GRID_SIZE = 2;
    const MAX_GRID_SIZE = 5;
    const MIN_REQUIRED_ADDENDS = 2;
    const MAX_REQUIRED_ADDENDS = 4;
    const MAX_GENERATION_ATTEMPTS = 20000;

    const OPERATIONS = Object.freeze({
        addition: Object.freeze({
            id: "addition",
            label: "Addition",
            symbol: "+",
            commutative: true
        }),
        subtraction: Object.freeze({
            id: "subtraction",
            label: "Subtraction",
            symbol: "−",
            commutative: false
        }),
        multiplication: Object.freeze({
            id: "multiplication",
            label: "Multiplication",
            symbol: "×",
            commutative: true
        }),
        division: Object.freeze({
            id: "division",
            label: "Division",
            symbol: "÷",
            commutative: false
        })
    });

    const DEFAULT_OPERATION = "addition";

    function normalizeOperation(operation) {
        if (
            typeof operation === "string" &&
            Object.prototype.hasOwnProperty.call(
                OPERATIONS,
                operation
            )
        ) {
            return operation;
        }

        return DEFAULT_OPERATION;
    }

    function getOperation(operation) {
        return OPERATIONS[
            normalizeOperation(operation)
        ];
    }

    /*
    Left-folds operand values with the operation.
    Returns null when the fold is not a whole number
    (division only counts when it divides exactly at
    every step). Subtraction may return a negative
    value; callers decide whether that is acceptable
    (a combo only matches a board tile, and board
    values are always >= 1, so negatives never match).
    */
    function computeResult(values, operation) {
        const normalizedOperation =
            normalizeOperation(operation);

        if (
            !Array.isArray(values) ||
            values.length === 0
        ) {
            return null;
        }

        if (normalizedOperation === "addition") {
            return values.reduce(
                (total, value) => total + value,
                0
            );
        }

        if (normalizedOperation === "multiplication") {
            return values.reduce(
                (total, value) => total * value,
                1
            );
        }

        if (normalizedOperation === "subtraction") {
            return values.slice(1).reduce(
                (total, value) => total - value,
                values[0]
            );
        }

        // division
        let result = values[0];

        for (
            let index = 1;
            index < values.length;
            index += 1
        ) {
            const divisor = values[index];

            if (
                divisor === 0 ||
                result % divisor !== 0
            ) {
                return null;
            }

            result /= divisor;
        }

        return result;
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
            const randomIndex = Math.floor(
                Math.random() * (index + 1)
            );

            [
                shuffled[index],
                shuffled[randomIndex]
            ] = [
                shuffled[randomIndex],
                shuffled[index]
            ];
        }

        return shuffled;
    }

    function normalizeExcludedIndexes(excludedIndexes) {
        if (!Array.isArray(excludedIndexes)) {
            return new Set();
        }

        return new Set(
            excludedIndexes.filter(Number.isInteger)
        );
    }

    function normalizeBoardSize(boardSize) {
        const parsedBoardSize = Number(boardSize);

        if (
            !Number.isInteger(parsedBoardSize) ||
            parsedBoardSize < 4
        ) {
            return DEFAULT_BOARD_SIZE;
        }

        return parsedBoardSize;
    }

    function normalizeGridSize(gridSize) {
        const parsedGridSize = Number(gridSize);

        if (
            !Number.isInteger(parsedGridSize) ||
            parsedGridSize < MIN_GRID_SIZE ||
            parsedGridSize > MAX_GRID_SIZE
        ) {
            return MIN_GRID_SIZE;
        }

        return parsedGridSize;
    }

    function getBoardSizeFromGridSize(gridSize) {
        const normalizedGridSize =
            normalizeGridSize(gridSize);

        return normalizedGridSize * normalizedGridSize;
    }

    function normalizeRequiredAddends(requiredAddends) {
        const parsedRequiredAddends = Number(requiredAddends);

        if (
            !Number.isInteger(parsedRequiredAddends) ||
            parsedRequiredAddends < MIN_REQUIRED_ADDENDS ||
            parsedRequiredAddends > MAX_REQUIRED_ADDENDS
        ) {
            return MIN_REQUIRED_ADDENDS;
        }

        return parsedRequiredAddends;
    }

    function getAllowedRequiredAddends(gridSize) {
        const normalizedGridSize =
            normalizeGridSize(gridSize);

        if (normalizedGridSize <= 2) {
            return [2];
        }

        if (normalizedGridSize === 3) {
            return [2, 3];
        }

        return [2, 3, 4];
    }

    function normalizeRequiredAddendsForGrid(
        requiredAddends,
        gridSize
    ) {
        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);

        const allowedRequiredAddends =
            getAllowedRequiredAddends(gridSize);

        if (
            allowedRequiredAddends.includes(
                normalizedRequiredAddends
            )
        ) {
            return normalizedRequiredAddends;
        }

        return allowedRequiredAddends[
            allowedRequiredAddends.length - 1
        ];
    }

    function getMinimumMaximumForBoard(
        minimum,
        boardSize
    ) {
        return minimum + boardSize - 1;
    }

    function getMinimumMaximumForAddends(
        minimum,
        requiredAddends
    ) {
        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);

        let smallestPossibleSum = 0;

        for (
            let offset = 0;
            offset < normalizedRequiredAddends;
            offset += 1
        ) {
            smallestPossibleSum += minimum + offset;
        }

        return smallestPossibleSum;
    }

    function getMinimumMaximumForOperation(
        minimum,
        boardSize,
        requiredAddends,
        operation
    ) {
        const normalizedOperation =
            normalizeOperation(operation);

        const boardMinimum =
            getMinimumMaximumForBoard(
                minimum,
                boardSize
            );

        if (normalizedOperation === "addition") {
            return Math.max(
                boardMinimum,
                getMinimumMaximumForAddends(
                    minimum,
                    requiredAddends
                )
            );
        }

        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);

        if (normalizedOperation === "subtraction") {
            /*
            Smallest workable construction: the subtrahends
            are the smallest distinct values, the difference
            is the next distinct value, and the starting
            number is their total. For 2 terms starting at 1
            that is 1 + 2 = 3 (1 subtrahend, difference 2).
            */
            let smallestStart =
                minimum + normalizedRequiredAddends - 1;

            for (
                let offset = 0;
                offset < normalizedRequiredAddends - 1;
                offset += 1
            ) {
                smallestStart += minimum + offset;
            }

            return Math.max(
                boardMinimum,
                smallestStart
            );
        }

        if (normalizedOperation === "multiplication") {
            /*
            Smallest workable product of the required count
            of distinct operands, where the product must not
            equal an operand. For minimum = 1 and 2 terms
            that is 2 x 3 = 6 (1 x anything equals the other
            operand); for 3+ terms from 1 it is 1 x 2 x 3...
            */
            let smallestProduct;

            if (minimum >= 2) {
                smallestProduct = 1;

                for (
                    let offset = 0;
                    offset < normalizedRequiredAddends;
                    offset += 1
                ) {
                    smallestProduct *= minimum + offset;
                }
            } else if (normalizedRequiredAddends === 2) {
                smallestProduct = 6;
            } else {
                smallestProduct = 1;

                for (
                    let factor = 2;
                    factor <= normalizedRequiredAddends;
                    factor += 1
                ) {
                    smallestProduct *= factor;
                }
            }

            return Math.max(
                boardMinimum,
                smallestProduct
            );
        }

        // division
        /*
        Dividend = quotient x all divisors, and the
        quotient plus every divisor are distinct whole
        numbers of magnitude >= 2 (a factor of 1 would make
        the dividend equal another tile value). The smallest
        case is the product of the required count of
        smallest such factors: 2 x 3 = 6 for 2 terms,
        2 x 3 x 4 = 24 for 3 terms (starting from 1).
        */
        const smallestFactor = Math.max(2, minimum);

        let smallestDividend = 1;

        for (
            let offset = 0;
            offset < normalizedRequiredAddends;
            offset += 1
        ) {
            smallestDividend *= smallestFactor + offset;
        }

        return Math.max(
            boardMinimum,
            smallestDividend
        );
    }

    function getMinimumMaximumForPuzzle(
        minimum,
        boardSize,
        requiredAddends
    ) {
        return getMinimumMaximumForOperation(
            minimum,
            boardSize,
            requiredAddends,
            DEFAULT_OPERATION
        );
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

    function buildComboRecord(
        numbers,
        addendIndexes,
        resultIndex,
        operation = DEFAULT_OPERATION
    ) {
        const normalizedOperation =
            normalizeOperation(operation);

        const operationMeta =
            OPERATIONS[normalizedOperation];

        const addendValues = addendIndexes.map(
            index => numbers[index]
        );

        const resultValue = numbers[resultIndex];

        const record = {
            addendIndexes: [...addendIndexes],
            resultIndex,

            addendValues,
            resultValue,

            operandIndexes: [...addendIndexes],
            operandValues: [...addendValues],

            operation: normalizedOperation,
            symbol: operationMeta.symbol,

            indexes: [
                ...addendIndexes,
                resultIndex
            ],

            equation:
                `${addendValues.join(` ${operationMeta.symbol} `)} = ` +
                `${resultValue}`
        };

        if (addendIndexes.length >= 2) {
            record.firstIndex = addendIndexes[0];
            record.secondIndex = addendIndexes[1];
            record.firstValue = addendValues[0];
            record.secondValue = addendValues[1];
        }

        return record;
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

        const needed =
            requiredCount - currentIndexes.length;

        for (
            let index = startIndex;
            index <= availableIndexes.length - needed;
            index += 1
        ) {
            currentIndexes.push(
                availableIndexes[index]
            );

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

    function collectIndexPermutations(
        indexes,
        currentIndexes,
        usedPositions,
        permutations
    ) {
        if (currentIndexes.length === indexes.length) {
            permutations.push([...currentIndexes]);
            return;
        }

        for (
            let position = 0;
            position < indexes.length;
            position += 1
        ) {
            if (usedPositions.has(position)) {
                continue;
            }

            usedPositions.add(position);
            currentIndexes.push(indexes[position]);

            collectIndexPermutations(
                indexes,
                currentIndexes,
                usedPositions,
                permutations
            );

            currentIndexes.pop();
            usedPositions.delete(position);
        }
    }

    function getOperandOrders(
        addendIndexes,
        operation
    ) {
        if (getOperation(operation).commutative) {
            return [addendIndexes];
        }

        const permutations = [];

        collectIndexPermutations(
            addendIndexes,
            [],
            new Set(),
            permutations
        );

        return permutations;
    }

    function findCombinations(
        numbers,
        requiredAddends = 2,
        excludedIndexes = [],
        operation = DEFAULT_OPERATION
    ) {
        if (!Array.isArray(numbers)) {
            return [];
        }

        const normalizedOperation =
            normalizeOperation(operation);

        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);

        const excluded =
            normalizeExcludedIndexes(excludedIndexes);

        const availableIndexes = numbers
            .map((_, index) => index)
            .filter(index => !excluded.has(index));

        if (
            availableIndexes.length <
            normalizedRequiredAddends + 1
        ) {
            return [];
        }

        const addendIndexCombinations = [];

        collectIndexCombinations(
            availableIndexes,
            normalizedRequiredAddends,
            0,
            [],
            addendIndexCombinations
        );

        const combinations = [];
        const seenComboKeys = new Set();

        addendIndexCombinations.forEach(
            addendIndexes => {
                const addendIndexSet =
                    new Set(addendIndexes);

                const operandOrders =
                    getOperandOrders(
                        addendIndexes,
                        normalizedOperation
                    );

                operandOrders.forEach(
                    orderedIndexes => {
                        const expectedResult =
                            computeResult(
                                orderedIndexes.map(
                                    index => numbers[index]
                                ),
                                normalizedOperation
                            );

                        if (expectedResult === null) {
                            return;
                        }

                        availableIndexes.forEach(
                            resultIndex => {
                                if (
                                    addendIndexSet.has(resultIndex)
                                ) {
                                    return;
                                }

                                if (
                                    numbers[resultIndex] !==
                                    expectedResult
                                ) {
                                    return;
                                }

                                const comboKey =
                                    `${orderedIndexes.join(",")}|${resultIndex}`;

                                if (seenComboKeys.has(comboKey)) {
                                    return;
                                }

                                seenComboKeys.add(comboKey);

                                combinations.push(
                                    buildComboRecord(
                                        numbers,
                                        orderedIndexes,
                                        resultIndex,
                                        normalizedOperation
                                    )
                                );
                            }
                        );
                    }
                );
            }
        );

        return combinations;
    }

    function findAdditionCombinations(
        numbers,
        requiredAddends = 2,
        excludedIndexes = []
    ) {
        return findCombinations(
            numbers,
            requiredAddends,
            excludedIndexes,
            "addition"
        );
    }

    function findAdditionTriples(
        numbers,
        excludedIndexes = []
    ) {
        return findAdditionCombinations(
            numbers,
            2,
            excludedIndexes
        );
    }

    function findComboForOperation(
        numbers,
        selectedIndexes,
        requiredAddends = 2,
        excludedIndexes = [],
        operation = DEFAULT_OPERATION
    ) {
        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);

        if (
            !Array.isArray(selectedIndexes) ||
            selectedIndexes.length !==
            normalizedRequiredAddends
        ) {
            return null;
        }

        const normalizedOperation =
            normalizeOperation(operation);

        const validCombinations =
            findCombinations(
                numbers,
                normalizedRequiredAddends,
                excludedIndexes,
                normalizedOperation
            );

        /*
        CLICK ORDER IS THE EQUATION ORDER (all operations).
        For subtraction and division a combo matches only
        when its ordered operand indexes equal the player's
        selectedIndexes in the exact order clicked: clicking
        3 then 12 does NOT strike a 12 - 3 = 9 / 12 ÷ 3 = 4
        target. For the commutative operations (addition,
        multiplication) any click order of the right operand
        set scores, but the returned record is rebuilt in
        click order so the displayed equation follows the
        clicks.
        */
        if (getOperation(normalizedOperation).commutative) {
            const selectedSet =
                new Set(selectedIndexes);

            const combo =
                validCombinations.find(candidate => {
                    if (
                        candidate.addendIndexes.length !==
                        selectedSet.size
                    ) {
                        return false;
                    }

                    return candidate.addendIndexes.every(
                        index => selectedSet.has(index)
                    );
                });

            if (!combo) {
                return null;
            }

            return buildComboRecord(
                numbers,
                [...selectedIndexes],
                combo.resultIndex,
                normalizedOperation
            );
        }

        return (
            validCombinations.find(combo => {
                if (
                    combo.addendIndexes.length !==
                    selectedIndexes.length
                ) {
                    return false;
                }

                return combo.addendIndexes.every(
                    (index, position) =>
                        index === selectedIndexes[position]
                );
            }) || null
        );
    }

    function findComboForSelection(
        numbers,
        selectedIndexes,
        requiredAddends = 2,
        excludedIndexes = []
    ) {
        return findComboForOperation(
            numbers,
            selectedIndexes,
            requiredAddends,
            excludedIndexes,
            "addition"
        );
    }

    function findTripleForSelection(
        numbers,
        selectedIndexes,
        excludedIndexes = []
    ) {
        return findComboForSelection(
            numbers,
            selectedIndexes,
            2,
            excludedIndexes
        );
    }

    function hasRemainingTriples(
        numbers,
        excludedIndexes = []
    ) {
        return (
            findAdditionTriples(
                numbers,
                excludedIndexes
            ).length > 0
        );
    }

    function hasRemainingCombinations(
        numbers,
        requiredAddends = 2,
        excludedIndexes = [],
        operation = DEFAULT_OPERATION
    ) {
        return (
            findCombinations(
                numbers,
                requiredAddends,
                excludedIndexes,
                operation
            ).length > 0
        );
    }

    function chooseAddends(
        minimum,
        maximum,
        requiredAddends
    ) {
        const values = getRangeValues(
            minimum,
            maximum
        );

        for (
            let attempt = 0;
            attempt < MAX_GENERATION_ATTEMPTS;
            attempt += 1
        ) {
            const shuffledValues = shuffle(values);
            const addends = shuffledValues
                .slice(0, requiredAddends);

            const result = addends.reduce(
                (sum, value) => sum + value,
                0
            );

            if (
                result <= maximum &&
                result >= minimum &&
                !addends.includes(result)
            ) {
                return {
                    addends,
                    result
                };
            }
        }

        const lowValues = values.slice(
            0,
            requiredAddends
        );

        const lowResult = lowValues.reduce(
            (sum, value) => sum + value,
            0
        );

        if (
            lowValues.length === requiredAddends &&
            lowResult <= maximum &&
            lowResult >= minimum &&
            !lowValues.includes(lowResult)
        ) {
            return {
                addends: lowValues,
                result: lowResult
            };
        }

        return null;
    }

    function isUsableBaseCombo(operands, result, minimum, maximum) {
        return (
            Number.isInteger(result) &&
            result >= minimum &&
            result <= maximum &&
            operands.every(
                value =>
                    Number.isInteger(value) &&
                    value >= minimum &&
                    value <= maximum
            ) &&
            !operands.includes(result) &&
            new Set(operands).size === operands.length
        );
    }

    function deterministicBaseCombo(
        minimum,
        maximum,
        requiredAddends,
        operation
    ) {
        if (operation === "addition") {
            // Ascending search with early exit; works for
            // negative minimums where the smallest values
            // alone would sum below the range floor.
            const search = (startValue, chosen) => {
                if (chosen.length === requiredAddends) {
                    const result = computeResult(
                        chosen,
                        "addition"
                    );

                    return isUsableBaseCombo(
                        chosen, result, minimum, maximum
                    )
                        ? { addends: [...chosen], result }
                        : null;
                }

                for (
                    let value = startValue;
                    value <= maximum;
                    value += 1
                ) {
                    chosen.push(value);

                    const found = search(
                        value + 1,
                        chosen
                    );

                    if (found) {
                        return found;
                    }

                    chosen.pop();
                }

                return null;
            };

            return search(minimum, []);
        }

        if (operation === "subtraction") {
            // subtrahends: minimum.. ; difference: the
            // next distinct value; start: their total.
            const subtrahends = [];

            for (
                let offset = 0;
                offset < requiredAddends - 1;
                offset += 1
            ) {
                subtrahends.push(minimum + offset);
            }

            const result =
                minimum + requiredAddends - 1;

            const start = subtrahends.reduce(
                (total, value) => total + value,
                result
            );

            const operands = [start, ...subtrahends];

            return isUsableBaseCombo(
                operands, result, minimum, maximum
            )
                ? { addends: operands, result }
                : null;
        }

        if (operation === "division") {
            const smallestFactor = Math.max(2, minimum);

            const divisors = [];

            for (
                let offset = 0;
                offset < requiredAddends - 1;
                offset += 1
            ) {
                divisors.push(smallestFactor + offset);
            }

            let quotient = smallestFactor;

            while (divisors.includes(quotient)) {
                quotient += 1;
            }

            const dividend = divisors.reduce(
                (total, value) => total * value,
                quotient
            );

            const operands = [dividend, ...divisors];

            return isUsableBaseCombo(
                operands, quotient, minimum, maximum
            )
                ? { addends: operands, result: quotient }
                : null;
        }

        if (operation === "multiplication") {
            // Smallest distinct operands whose product
            // is not itself one of the operands. Searched
            // ascending with early exit, so the first
            // workable set is returned immediately.
            const search = (startValue, chosen) => {
                if (chosen.length === requiredAddends) {
                    const result = computeResult(
                        chosen,
                        "multiplication"
                    );

                    return isUsableBaseCombo(
                        chosen, result, minimum, maximum
                    )
                        ? { addends: [...chosen], result }
                        : null;
                }

                for (
                    let value = startValue;
                    value <= maximum;
                    value += 1
                ) {
                    chosen.push(value);

                    const found = search(
                        value + 1,
                        chosen
                    );

                    if (found) {
                        return found;
                    }

                    chosen.pop();
                }

                return null;
            };

            return search(minimum, []);
        }

        return null;
    }

    function chooseOperands(
        minimum,
        maximum,
        requiredAddends,
        operation,
        allowNegatives = false
    ) {
        const normalizedOperation =
            normalizeOperation(operation);

        if (normalizedOperation === "addition") {
            return (
                chooseAddends(
                    minimum,
                    maximum,
                    requiredAddends
                ) ||
                deterministicBaseCombo(
                    minimum,
                    maximum,
                    requiredAddends,
                    "addition"
                )
            );
        }

        const values = getRangeValues(
            minimum,
            maximum
        );

        for (
            let attempt = 0;
            attempt < MAX_GENERATION_ATTEMPTS;
            attempt += 1
        ) {
            let operands = null;

            if (normalizedOperation === "subtraction") {
                operands = shuffle(values)
                    .slice(0, requiredAddends);

                if (!allowNegatives) {
                    // Largest first, so the result of the
                    // left fold stays non-negative.
                    operands.sort((a, b) => b - a);
                }
                // With negatives allowed the sampled order
                // stands, so results may be negative.
            } else if (normalizedOperation === "multiplication") {
                operands = shuffle(values)
                    .slice(0, requiredAddends);
            } else {
                // division: sample the divisors and the
                // quotient, then build the dividend.
                // Factors need magnitude >= 2 (a factor of
                // 1 or -1 would make the dividend equal
                // another tile value, breaking uniqueness)
                // and may never be 0.
                const factors = shuffle(
                    values.filter(
                        value => Math.abs(value) >= 2
                    )
                );

                if (
                    factors.length <
                    requiredAddends
                ) {
                    break;
                }

                const divisors = factors.slice(
                    0,
                    requiredAddends - 1
                );

                const quotient = factors.find(
                    value => !divisors.includes(value)
                );

                if (quotient === undefined) {
                    continue;
                }

                const dividend = divisors.reduce(
                    (total, value) => total * value,
                    quotient
                );

                operands = [dividend, ...divisors];

                if (
                    isUsableBaseCombo(
                        operands,
                        quotient,
                        minimum,
                        maximum
                    )
                ) {
                    return {
                        addends: operands,
                        result: quotient
                    };
                }

                continue;
            }

            const result = computeResult(
                operands,
                normalizedOperation
            );

            if (
                result !== null &&
                isUsableBaseCombo(
                    operands, result, minimum, maximum
                )
            ) {
                return {
                    addends: operands,
                    result
                };
            }
        }

        return deterministicBaseCombo(
            minimum,
            maximum,
            requiredAddends,
            normalizedOperation
        );
    }

    function createNumberPuzzle(options = {}) {
        const minimum = Number(options.minimum);
        const maximum = Number(options.maximum);
        const gridSize = normalizeGridSize(
            options.gridSize || MIN_GRID_SIZE
        );
        const boardSize =
            getBoardSizeFromGridSize(gridSize);
        const requiredAddends =
            normalizeRequiredAddendsForGrid(
                options.requiredAddends ||
                    MIN_REQUIRED_ADDENDS,
                gridSize
            );
        const operation =
            normalizeOperation(options.operation);
        const allowNegatives =
            Boolean(options.allowNegatives);

        validateRange(
            minimum,
            maximum,
            boardSize,
            requiredAddends,
            operation,
            allowNegatives
        );

        for (
            let attempt = 0;
            attempt < MAX_GENERATION_ATTEMPTS;
            attempt += 1
        ) {
            const baseCombo = chooseOperands(
                minimum,
                maximum,
                requiredAddends,
                operation,
                allowNegatives
            );

            if (!baseCombo) {
                break;
            }

            const numbers = [
                ...baseCombo.addends,
                baseCombo.result
            ];

            const usedNumbers = new Set(numbers);

            const availableValues = shuffle(
                getRangeValues(minimum, maximum)
                    .filter(
                        value =>
                            !usedNumbers.has(value)
                    )
            );

            while (
                numbers.length < boardSize &&
                availableValues.length > 0
            ) {
                numbers.push(
                    availableValues.pop()
                );
            }

            if (numbers.length !== boardSize) {
                continue;
            }

            const shuffledNumbers =
                shuffle(numbers);

            const combinations =
                findCombinations(
                    shuffledNumbers,
                    requiredAddends,
                    [],
                    operation
                );

            if (combinations.length === 0) {
                continue;
            }

            return {
                numbers: shuffledNumbers,
                triples:
                    requiredAddends === 2
                        ? combinations
                        : findCombinations(
                            shuffledNumbers,
                            2,
                            [],
                            operation
                        ),
                combinations,
                gridSize,
                boardSize,
                requiredAddends,
                operation,
                allowNegatives
            };
        }

        throw new Error(
            "A valid puzzle could not be generated. " +
            "Increase the maximum number range."
        );
    }

    /*
    Decides whether an existing board can stay in play after
    a settings change (operation and/or Allow Negatives). The
    board is playable under the new settings only when:
      (a) every tile is legal — whole numbers, and no negative
          tiles while Allow Negatives is off (the same -20
          floor the generator enforces while it is on); and
      (b) at least one valid combination exists on those exact
          tiles for the operation, found by findCombinations
          (which applies the strict click-order rules for
          subtraction / division).
    Returns { playable, reason, combinations } where reason is
    "playable", "no-board", "illegal-tiles" or "no-combination".
    Pure and DOM-free so the controllers and the node test
    suites share one implementation of the decision.
    */
    function evaluateBoardForSettings(
        numbers,
        options = {}
    ) {
        const operation =
            normalizeOperation(options.operation);

        const allowNegatives =
            Boolean(options.allowNegatives);

        const requiredAddends =
            normalizeRequiredAddends(
                options.requiredAddends
            );

        if (
            !Array.isArray(numbers) ||
            numbers.length < requiredAddends + 1
        ) {
            return {
                playable: false,
                reason: "no-board",
                combinations: []
            };
        }

        const minimumTile =
            allowNegatives ? -20 : 1;

        const tilesLegal = numbers.every(
            value =>
                Number.isInteger(value) &&
                value >= minimumTile
        );

        if (!tilesLegal) {
            return {
                playable: false,
                reason: "illegal-tiles",
                combinations: []
            };
        }

        const combinations =
            findCombinations(
                numbers,
                requiredAddends,
                [],
                operation
            );

        if (combinations.length === 0) {
            return {
                playable: false,
                reason: "no-combination",
                combinations
            };
        }

        return {
            playable: true,
            reason: "playable",
            combinations
        };
    }

    function createFourNumberPuzzle(
        minimum,
        maximum
    ) {
        return createNumberPuzzle({
            minimum,
            maximum,
            gridSize: 2,
            requiredAddends: 2
        });
    }

    function validateRange(
        minimum,
        maximum,
        boardSize = DEFAULT_BOARD_SIZE,
        requiredAddends = MIN_REQUIRED_ADDENDS,
        operation = DEFAULT_OPERATION,
        allowNegatives = false
    ) {
        const normalizedBoardSize =
            normalizeBoardSize(boardSize);
        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);
        const requiredMaximum =
            getMinimumMaximumForOperation(
                minimum,
                normalizedBoardSize,
                normalizedRequiredAddends,
                operation
            );

        const minimumFloor =
            allowNegatives ? -20 : 1;

        if (
            !Number.isInteger(minimum) ||
            !Number.isInteger(maximum) ||
            minimum < minimumFloor ||
            maximum <= minimum
        ) {
            throw new Error(
                "Minimum and maximum must be whole numbers, " +
                "and maximum must be greater than minimum." +
                (
                    allowNegatives
                        ? " With negatives allowed, the minimum may go down to -20."
                        : ""
                )
            );
        }

        if (
            maximum - minimum + 1 <
            normalizedBoardSize
        ) {
            throw new Error(
                `This grid needs at least ${normalizedBoardSize} unique numbers.`
            );
        }

        if (maximum < requiredMaximum) {
            throw new Error(
                `${normalizedRequiredAddends} terms starting at ${minimum} need the maximum to be at least ${requiredMaximum}.`
            );
        }
    }

    global.OperationHuntPuzzleEngine =
        Object.freeze({
            OPERATIONS,
            normalizeOperation,
            getOperation,
            computeResult,
            findCombinations,
            findComboForOperation,
            findAdditionCombinations,
            findAdditionTriples,
            findComboForSelection,
            findTripleForSelection,
            hasRemainingCombinations,
            hasRemainingTriples,
            createNumberPuzzle,
            createFourNumberPuzzle,
            evaluateBoardForSettings,
            getAllowedRequiredAddends,
            getMinimumMaximumForBoard,
            getMinimumMaximumForAddends,
            getMinimumMaximumForPuzzle,
            getMinimumMaximumForOperation
        });
})(window);
