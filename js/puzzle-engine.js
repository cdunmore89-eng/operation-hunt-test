"use strict";

(function createPuzzleEngine(global) {
    const DEFAULT_BOARD_SIZE = 4;
    const MIN_GRID_SIZE = 2;
    const MAX_GRID_SIZE = 5;
    const MIN_REQUIRED_ADDENDS = 2;
    const MAX_REQUIRED_ADDENDS = 4;
    const MAX_GENERATION_ATTEMPTS = 20000;

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

    function getMinimumMaximumForPuzzle(
        minimum,
        boardSize,
        requiredAddends
    ) {
        return Math.max(
            getMinimumMaximumForBoard(
                minimum,
                boardSize
            ),
            getMinimumMaximumForAddends(
                minimum,
                requiredAddends
            )
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
        resultIndex
    ) {
        const addendValues = addendIndexes.map(
            index => numbers[index]
        );

        const resultValue = numbers[resultIndex];

        const record = {
            addendIndexes: [...addendIndexes],
            resultIndex,

            addendValues,
            resultValue,

            indexes: [
                ...addendIndexes,
                resultIndex
            ],

            equation:
                `${addendValues.join(" + ")} = ` +
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

    function findAdditionCombinations(
        numbers,
        requiredAddends = 2,
        excludedIndexes = []
    ) {
        if (!Array.isArray(numbers)) {
            return [];
        }

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

        addendIndexCombinations.forEach(
            addendIndexes => {
                const addendIndexSet =
                    new Set(addendIndexes);

                const expectedResult =
                    addendIndexes.reduce(
                        (sum, index) =>
                            sum + numbers[index],
                        0
                    );

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

                        combinations.push(
                            buildComboRecord(
                                numbers,
                                addendIndexes,
                                resultIndex
                            )
                        );
                    }
                );
            }
        );

        return combinations;
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

    function findComboForSelection(
        numbers,
        selectedIndexes,
        requiredAddends = 2,
        excludedIndexes = []
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

        const selectedSet =
            new Set(selectedIndexes);

        const validCombinations =
            findAdditionCombinations(
                numbers,
                normalizedRequiredAddends,
                excludedIndexes
            );

        return (
            validCombinations.find(combo => {
                if (
                    combo.addendIndexes.length !==
                    selectedSet.size
                ) {
                    return false;
                }

                return combo.addendIndexes.every(
                    index => selectedSet.has(index)
                );
            }) || null
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
        excludedIndexes = []
    ) {
        return (
            findAdditionCombinations(
                numbers,
                requiredAddends,
                excludedIndexes
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
            !lowValues.includes(lowResult)
        ) {
            return {
                addends: lowValues,
                result: lowResult
            };
        }

        return null;
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

        validateRange(
            minimum,
            maximum,
            boardSize,
            requiredAddends
        );

        for (
            let attempt = 0;
            attempt < MAX_GENERATION_ATTEMPTS;
            attempt += 1
        ) {
            const baseCombo = chooseAddends(
                minimum,
                maximum,
                requiredAddends
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
                findAdditionCombinations(
                    shuffledNumbers,
                    requiredAddends
                );

            if (combinations.length === 0) {
                continue;
            }

            return {
                numbers: shuffledNumbers,
                triples:
                    requiredAddends === 2
                        ? combinations
                        : findAdditionCombinations(
                            shuffledNumbers,
                            2
                        ),
                combinations,
                gridSize,
                boardSize,
                requiredAddends
            };
        }

        throw new Error(
            "A valid puzzle could not be generated. " +
            "Increase the maximum number range."
        );
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
        requiredAddends = MIN_REQUIRED_ADDENDS
    ) {
        const normalizedBoardSize =
            normalizeBoardSize(boardSize);
        const normalizedRequiredAddends =
            normalizeRequiredAddends(requiredAddends);
        const requiredMaximum =
            getMinimumMaximumForPuzzle(
                minimum,
                normalizedBoardSize,
                normalizedRequiredAddends
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
            findAdditionCombinations,
            findAdditionTriples,
            findComboForSelection,
            findTripleForSelection,
            hasRemainingCombinations,
            hasRemainingTriples,
            createNumberPuzzle,
            createFourNumberPuzzle,
            getAllowedRequiredAddends,
            getMinimumMaximumForBoard,
            getMinimumMaximumForAddends,
            getMinimumMaximumForPuzzle
        });
})(window);
