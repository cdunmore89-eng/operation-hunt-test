"use strict";

/*
Operation Hunt — Algebra Mode engine.

This module is deliberately separate from js/puzzle-engine.js. The
arithmetic engine's behaviour and legacy API are the regression gate
for this pass; Algebra Mode builds beside it and reuses its public
combo machinery for Evaluate Expressions.

Every expression/equation below is generated from developer-written
templates and stored as data. Faces are rendered from that data at
display time. Nothing here parses free-form mathematics.
*/

(function createAlgebraEngine(global) {
    const puzzleEngine = global.OperationHuntPuzzleEngine;

    if (!puzzleEngine) {
        throw new Error("OperationHuntPuzzleEngine did not load.");
    }

    const CONTENT_IDS = Object.freeze(["arithmetic", "algebra"]);

    const GRADE_BAND_IDS = Object.freeze(["k-2", "3-5", "6-8"]);

    const ALGEBRA_SKILL_IDS = Object.freeze([
        "missing-number",
        "evaluate",
        "solve",
        "equivalent",
        "mixed"
    ]);

    const ACTUAL_ALGEBRA_SKILL_IDS = Object.freeze([
        "missing-number",
        "evaluate",
        "solve",
        "equivalent"
    ]);

    const SOLVE_STEP_IDS = Object.freeze([
        "one-step",
        "two-step",
        "mixed"
    ]);

    const SKILLS_BY_BAND = Object.freeze({
        "k-2": Object.freeze(["missing-number"]),
        "3-5": Object.freeze(["missing-number", "evaluate", "solve"]),
        "6-8": Object.freeze([
            "missing-number",
            "evaluate",
            "solve",
            "equivalent"
        ])
    });

    const SKILL_LABELS = Object.freeze({
        "missing-number": "Missing Number",
        evaluate: "Evaluate Expressions",
        solve: "Solve for x",
        equivalent: "Equivalent Expressions",
        mixed: "Mixed Skills"
    });

    const SKILL_DESCRIPTIONS = Object.freeze({
        "missing-number":
            "Students pick the value that makes the banner equation true.",
        evaluate:
            "Students evaluate the expressions, then hunt for a matching pair and target.",
        solve:
            "Students solve the banner equation by picking the value that makes it true.",
        equivalent:
            "Students find the two expressions that are worth the same for every x.",
        mixed:
            "Rounds rotate among the algebra skills allowed for this grade band."
    });

    const BAND_RANGE_TEXT = Object.freeze({
        "k-2": "Numbers within 20",
        "3-5": "Numbers within 100",
        "6-8": "Numbers within 200"
    });

    const MAX_GENERATION_ATTEMPTS = 1200;

    function normalizeContent(value) {
        return CONTENT_IDS.includes(value) ? value : "arithmetic";
    }

    function normalizeGradeBand(value) {
        return GRADE_BAND_IDS.includes(value) ? value : "k-2";
    }

    function getSkillsForBand(gradeBand) {
        return [
            ...(SKILLS_BY_BAND[normalizeGradeBand(gradeBand)] || [])
        ];
    }

    function normalizeAlgebraSkill(value, gradeBand = "k-2") {
        const band = normalizeGradeBand(gradeBand);

        if (value === "mixed") {
            return "mixed";
        }

        return getSkillsForBand(band).includes(value)
            ? value
            : "missing-number";
    }

    function normalizeSolveSteps(value) {
        return SOLVE_STEP_IDS.includes(value) ? value : "mixed";
    }

    function randomInteger(minimum, maximum) {
        return Math.floor(
            Math.random() * (maximum - minimum + 1)
        ) + minimum;
    }

    function randomChoice(values) {
        return values[randomInteger(0, values.length - 1)];
    }

    function shuffle(values) {
        const shuffled = [...values];

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(
                Math.random() * (index + 1)
            );

            [shuffled[index], shuffled[randomIndex]] = [
                shuffled[randomIndex],
                shuffled[index]
            ];
        }

        return shuffled;
    }

    function formatNumber(value) {
        return String(value).replace(/-/g, "−");
    }

    function formatSignedTerm(value) {
        return value < 0
            ? ` − ${formatNumber(Math.abs(value))}`
            : ` + ${formatNumber(value)}`;
    }

    function canonicalFace(a, b, variable = "x") {
        if (a === 0) {
            return formatNumber(b);
        }

        let face;

        if (a === 1) {
            face = variable;
        } else if (a === -1) {
            face = `−${variable}`;
        } else {
            face = `${formatNumber(a)}${variable}`;
        }

        if (b > 0) {
            face += ` + ${formatNumber(b)}`;
        } else if (b < 0) {
            face += ` − ${formatNumber(Math.abs(b))}`;
        }

        return face;
    }

    function evaluateCanonical(canonical, variableValue) {
        return canonical.a * variableValue + canonical.b;
    }

    function operandFace(face) {
        const needsParentheses =
            / \+ | − /.test(face.slice(1)) || face.startsWith("−");

        return needsParentheses ? `(${face})` : face;
    }

    function getFaceTier(face) {
        const length = String(face || "").length;

        if (length <= 3) return 0;
        if (length <= 5) return 1;
        if (length <= 8) return 2;
        if (length <= 11) return 3;
        return 4;
    }

    function normalizeGridSize(gridSize) {
        const parsed = Number(gridSize);
        return Number.isInteger(parsed) && parsed >= 2 && parsed <= 5
            ? parsed
            : 2;
    }

    function normalizeAlgebraSettings(options = {}) {
        const gradeBand = normalizeGradeBand(options.gradeBand);
        const requestedSkill = normalizeAlgebraSkill(
            options.skill ?? options.algebraSkill,
            gradeBand
        );

        return {
            content: "algebra",
            skill: requestedSkill,
            gradeBand,
            gridSize: normalizeGridSize(options.gridSize),
            operation: puzzleEngine.normalizeOperation(options.operation),
            allowNegatives: Boolean(options.allowNegatives),
            solveSteps: normalizeSolveSteps(
                options.solveSteps ?? options.steps
            )
        };
    }

    function resolveActualSkill(settings) {
        if (settings.skill !== "mixed") {
            return settings.skill;
        }

        return randomChoice(getSkillsForBand(settings.gradeBand));
    }

    function makeTile(face, value, kind, extras = {}) {
        return {
            face: String(face),
            value: value === undefined ? null : value,
            kind,
            canonical: extras.canonical
                ? { ...extras.canonical }
                : null,
            templateId: extras.templateId || null,
            errorPatternId: extras.errorPatternId || null,
            missFeedback: extras.missFeedback || null
        };
    }

    function finishRound(round) {
        round.tiles.forEach(tile => {
            tile.faceTier = getFaceTier(tile.face);
        });

        round.metadata = {
            content: "algebra",
            skill: round.skill,
            requestedSkill: round.requestedSkill,
            gradeBand: round.gradeBand,
            templateId: round.templateId,
            operation: round.operation,
            allowNegatives: round.allowNegatives,
            gridSize: round.gridSize,
            solveSteps: round.solveSteps
        };

        const verification = verifyAlgebraRound(round);

        if (!verification.valid) {
            throw new Error(
                `Generated algebra round failed verification: ${verification.errors.join("; ")}`
            );
        }

        return round;
    }

    function baseRound(settings, skill) {
        const gridSize = settings.gridSize;

        return {
            content: "algebra",
            skill,
            requestedSkill: settings.skill,
            gradeBand: settings.gradeBand,
            solveSteps: settings.solveSteps,
            operation: settings.operation,
            allowNegatives: settings.allowNegatives,
            gridSize,
            boardSize: gridSize * gridSize,
            variable: null,
            banner: {
                kind: "instruction",
                text: ""
            },
            question: null,
            tiles: [],
            solution: null,
            feedback: {
                strike: "",
                reveal: "",
                sayIt: ""
            },
            templateId: null
        };
    }

    /*
    ================================================================
    Missing Number
    ================================================================
    */

    function missingEquationValue(question, candidate) {
        switch (question.templateId) {
            case "missing-add-start":
                return candidate + question.a;
            case "missing-sub-start":
                return candidate - question.a;
            case "missing-subtrahend":
                return question.a - candidate;
            case "missing-factor":
                return question.a * candidate;
            case "missing-dividend":
                return candidate % question.a === 0
                    ? candidate / question.a
                    : null;
            case "missing-two-part":
                return question.a * candidate +
                    (question.sign === "subtract" ? -question.b : question.b);
            default:
                return null;
        }
    }

    function missingTarget(question) {
        return question.templateId === "missing-dividend"
            ? question.b
            : question.c ?? question.b;
    }

    function missingSubstitution(question, candidate) {
        const value = missingEquationValue(question, candidate);

        if (value === null) {
            return {
                text: `${formatNumber(candidate)} does not divide exactly by ${formatNumber(question.a)}`,
                value: null
            };
        }

        let left;

        switch (question.templateId) {
            case "missing-add-start":
                left = `${formatNumber(candidate)} + ${formatNumber(question.a)}`;
                break;
            case "missing-sub-start":
                left = `${formatNumber(candidate)} − ${formatNumber(question.a)}`;
                break;
            case "missing-subtrahend":
                left = `${formatNumber(question.a)} − ${formatNumber(candidate)}`;
                break;
            case "missing-factor":
                left = `${formatNumber(question.a)} × ${formatNumber(candidate)}`;
                break;
            case "missing-dividend":
                left = `${formatNumber(candidate)} ÷ ${formatNumber(question.a)}`;
                break;
            case "missing-two-part":
                left = `${formatNumber(question.a)}(${formatNumber(candidate)}) ${question.sign === "subtract" ? "−" : "+"} ${formatNumber(question.b)}`;
                break;
            default:
                left = formatNumber(candidate);
        }

        return {
            text: `${left} = ${formatNumber(value)}`,
            value
        };
    }

    function missingInverseLine(question) {
        const solution = question.solution;

        switch (question.templateId) {
            case "missing-add-start":
                return `${formatNumber(question.b)} − ${formatNumber(question.a)} = ${formatNumber(solution)}`;
            case "missing-sub-start":
                return `${formatNumber(question.b)} + ${formatNumber(question.a)} = ${formatNumber(solution)}`;
            case "missing-subtrahend":
                return `${formatNumber(question.a)} − ${formatNumber(question.b)} = ${formatNumber(solution)}`;
            case "missing-factor":
                return `${formatNumber(question.b)} ÷ ${formatNumber(question.a)} = ${formatNumber(solution)}`;
            case "missing-dividend":
                return `${formatNumber(question.b)} × ${formatNumber(question.a)} = ${formatNumber(solution)}`;
            case "missing-two-part":
                return question.sign === "subtract"
                    ? `(${formatNumber(question.c)} + ${formatNumber(question.b)}) ÷ ${formatNumber(question.a)} = ${formatNumber(solution)}`
                    : `(${formatNumber(question.c)} − ${formatNumber(question.b)}) ÷ ${formatNumber(question.a)} = ${formatNumber(solution)}`;
            default:
                return formatNumber(solution);
        }
    }

    function missingCompletedEquation(question) {
        const solution = formatNumber(question.solution);

        if (question.templateId === "missing-two-part") {
            return `${formatNumber(question.a)}(${solution}) ${question.sign === "subtract" ? "−" : "+"} ${formatNumber(question.b)} = ${formatNumber(question.c)}`;
        }

        return question.display.replace(question.unknownSymbol, solution);
    }

    function makeMissingQuestion(band, allowNegatives, example = null) {
        if (example) {
            return { ...example };
        }

        const symbol = band === "k-2"
            ? randomChoice(["□", "★"])
            : randomChoice(["x", "x", "n"]);

        const max = band === "k-2" ? 20 : band === "3-5" ? 100 : 200;
        const useNegatives = allowNegatives && band === "6-8";

        const templates = band === "k-2"
            ? ["missing-add-start", "missing-sub-start", "missing-subtrahend"]
            : [
                "missing-add-start",
                "missing-sub-start",
                "missing-subtrahend",
                "missing-factor",
                "missing-dividend",
                "missing-two-part"
            ];

        const templateId = randomChoice(templates);
        let a;
        let b;
        let c;
        let solution;
        let sign = "add";

        if (templateId === "missing-add-start") {
            if (useNegatives) {
                a = randomInteger(-12, 20);
                solution = randomInteger(-20, 50);
                b = solution + a;
            } else {
                a = randomInteger(2, Math.min(15, max - 2));
                solution = randomInteger(2, max - a);
                b = solution + a;
            }
            c = b;
        } else if (templateId === "missing-sub-start") {
            if (useNegatives) {
                a = randomInteger(2, 20);
                solution = randomInteger(-10, 60);
                b = solution - a;
            } else {
                solution = randomInteger(4, max);
                a = randomInteger(2, solution - 2);
                b = solution - a;
            }
            c = b;
        } else if (templateId === "missing-subtrahend") {
            if (useNegatives) {
                a = randomInteger(5, 50);
                solution = randomInteger(-20, 40);
                b = a - solution;
            } else {
                a = randomInteger(5, max);
                solution = randomInteger(2, a - 2);
                b = a - solution;
            }
            c = b;
        } else if (templateId === "missing-factor") {
            a = randomInteger(2, 12);
            solution = randomInteger(2, 12);
            b = a * solution;
            c = b;
        } else if (templateId === "missing-dividend") {
            a = randomInteger(2, 12);
            b = randomInteger(2, 12);
            solution = a * b;
            c = b;
        } else {
            a = randomInteger(2, 9);
            solution = randomInteger(2, 12);
            b = randomInteger(2, 20);
            sign = randomChoice(["add", "subtract"]);
            c = a * solution + (sign === "subtract" ? -b : b);
        }

        let display;

        switch (templateId) {
            case "missing-add-start":
                display = `${symbol} + ${formatNumber(a)} = ${formatNumber(b)}`;
                break;
            case "missing-sub-start":
                display = `${symbol} − ${formatNumber(a)} = ${formatNumber(b)}`;
                break;
            case "missing-subtrahend":
                display = `${formatNumber(a)} − ${symbol} = ${formatNumber(b)}`;
                break;
            case "missing-factor":
                display = `${formatNumber(a)} × ${symbol} = ${formatNumber(b)}`;
                break;
            case "missing-dividend":
                display = `${symbol} ÷ ${formatNumber(a)} = ${formatNumber(b)}`;
                break;
            default:
                display = `${formatNumber(a)}${symbol} ${sign === "subtract" ? "−" : "+"} ${formatNumber(b)} = ${formatNumber(c)}`;
        }

        return {
            kind: "missing-number",
            templateId,
            unknownSymbol: symbol,
            a,
            b,
            c,
            sign,
            solution,
            display
        };
    }

    /*
    Board composition for the single-answer skills: the
    solution is always dealt, the named error-pattern
    distractors come next (they are the teaching), and
    arithmetic slips / near pool values fill any remaining
    slots on bigger boards. Shuffling the whole candidate
    list and slicing — the earlier approach — usually dealt
    a board of pure slips and could even slice the
    solution itself off the board.
    */
    function pickBoardCandidates(candidates, boardSize) {
        const [solution, ...distractors] = candidates;

        const named = distractors.filter(candidate => (
            candidate.errorPatternId &&
            candidate.errorPatternId !== "arithmetic-slip"
        ));

        const filler = distractors.filter(candidate => (
            !named.includes(candidate)
        ));

        return [solution, ...named, ...filler].slice(0, boardSize);
    }

    function missingDistractorCandidates(question, band, boardSize) {
        const solution = question.solution;
        const candidates = [];
        const seen = new Set([solution]);

        function add(value, errorPatternId) {
            if (
                Number.isInteger(value) &&
                value !== solution &&
                !seen.has(value)
            ) {
                seen.add(value);
                candidates.push({ value, errorPatternId });
            }
        }

        [question.a, question.b, question.c].forEach(value => {
            add(value, "visible-number");
        });

        let wrongOperation;

        switch (question.templateId) {
            case "missing-add-start":
                wrongOperation = question.b + question.a;
                break;
            case "missing-sub-start":
                wrongOperation = question.b - question.a;
                break;
            case "missing-subtrahend":
                wrongOperation = question.a + question.b;
                break;
            case "missing-factor":
                wrongOperation = question.b - question.a;
                break;
            case "missing-dividend":
                wrongOperation = question.b % question.a === 0
                    ? question.b / question.a
                    : question.b - question.a;
                break;
            default:
                wrongOperation = question.sign === "subtract"
                    ? question.c - question.b
                    : question.c + question.b;
        }

        add(wrongOperation, "wrong-operation");
        add(solution + 1, "arithmetic-slip");
        add(solution - 1, "arithmetic-slip");
        add(solution + 2, "arithmetic-slip");
        add(solution - 2, "arithmetic-slip");
        add(solution + 10, "arithmetic-slip");
        add(solution - 10, "arithmetic-slip");

        const poolMinimum = band === "k-2"
            ? 1
            : question.solution < 0 || question.a < 0 || question.b < 0
                ? -20
                : 1;
        const poolMaximum = band === "k-2"
            ? Math.max(25, boardSize)
            : band === "3-5"
                ? 100
                : 200;

        const pool = [];

        for (let value = poolMinimum; value <= poolMaximum; value += 1) {
            if (!seen.has(value)) {
                pool.push(value);
            }
        }

        pool.sort((left, right) => (
            Math.abs(left - solution) - Math.abs(right - solution)
        ));

        pool.forEach(value => add(value, "arithmetic-slip"));

        return candidates;
    }

    function missingMissFeedback(question, tile) {
        const substitution = missingSubstitution(question, tile.value);
        const target = missingTarget(question);
        let comparison = "";

        if (substitution.value !== null && substitution.value !== target) {
            comparison = substitution.value > target
                ? " — too big."
                : " — too small.";
        }

        const patternLine = tile.errorPatternId === "visible-number"
            ? " That number is already in the equation."
            : tile.errorPatternId === "wrong-operation"
                ? " That choice uses the wrong operation."
                : "";

        return `${substitution.text}${comparison}${patternLine} Try the inverse: ${missingInverseLine(question)}.`;
    }

    function buildMissingRound(settings, example = null) {
        const question = makeMissingQuestion(
            settings.gradeBand,
            settings.allowNegatives,
            example?.question
        );

        const round = baseRound(settings, "missing-number");
        round.question = question;
        round.templateId = question.templateId;
        round.banner = {
            kind: "equation",
            text: question.display,
            label: "Missing Number"
        };

        const candidateValues = example?.board
            ? example.board.map(value => ({
                value,
                errorPatternId: value === question.solution
                    ? null
                    : "designed-distractor"
            }))
            : [
                { value: question.solution, errorPatternId: null },
                ...missingDistractorCandidates(
                    question,
                    settings.gradeBand,
                    round.boardSize
                )
            ];

        const selectedCandidates = example?.board
            ? candidateValues
            : pickBoardCandidates(candidateValues, round.boardSize);

        if (selectedCandidates.length !== round.boardSize) {
            throw new Error("Missing Number board could not be filled.");
        }

        const orderedCandidates = example?.board
            ? selectedCandidates
            : shuffle(selectedCandidates);

        round.tiles = orderedCandidates.map(candidate => {
            const tile = makeTile(
                formatNumber(candidate.value),
                candidate.value,
                "candidate",
                {
                    templateId: question.templateId,
                    errorPatternId: candidate.errorPatternId
                }
            );

            if (candidate.value !== question.solution) {
                tile.missFeedback = missingMissFeedback(question, tile);
            }

            return tile;
        });

        const solutionIndex = round.tiles.findIndex(
            tile => tile.value === question.solution
        );

        round.solution = {
            type: "single",
            indexes: [solutionIndex],
            resultIndex: solutionIndex,
            faceEquation: missingCompletedEquation(question),
            valueEquation: missingCompletedEquation(question),
            reasoning: `${formatNumber(question.solution)} — because ${missingInverseLine(question)}.`
        };

        round.feedback = {
            strike: round.solution.reasoning,
            reveal: round.solution.reasoning,
            sayIt: missingCompletedEquation(question)
        };

        return finishRound(round);
    }

    /*
    ================================================================
    Evaluate Expressions
    ================================================================
    */

    function expressionSpecForValue(
        value,
        variableValue,
        variable,
        gradeBand,
        wantExpression
    ) {
        const specs = [];
        const coefficientMax = gradeBand === "3-5" ? 9 : 12;
        const constantMax = gradeBand === "3-5" ? 9 : 12;

        specs.push({
            face: formatNumber(value),
            value,
            kind: "number",
            canonical: null,
            templateId: "number-tile"
        });

        if (variableValue !== 0 && value % variableValue === 0) {
            const a = value / variableValue;

            if (Number.isInteger(a) && Math.abs(a) >= 2 && Math.abs(a) <= coefficientMax) {
                specs.push({
                    face: canonicalFace(a, 0, variable),
                    value,
                    kind: "expression",
                    canonical: { a, b: 0 },
                    templateId: "expression-ax"
                });
            }
        }

        const difference = value - variableValue;

        if (Math.abs(difference) >= 2 && Math.abs(difference) <= constantMax) {
            specs.push({
                face: canonicalFace(1, difference, variable),
                value,
                kind: "expression",
                canonical: { a: 1, b: difference },
                templateId: "expression-x-plus-constant"
            });
        }

        if (gradeBand === "6-8") {
            for (let a = 2; a <= coefficientMax; a += 1) {
                const b = value - a * variableValue;

                if (Math.abs(b) >= 1 && Math.abs(b) <= constantMax) {
                    specs.push({
                        face: canonicalFace(a, b, variable),
                        value,
                        kind: "expression",
                        canonical: { a, b },
                        templateId: "expression-ax-plus-b"
                    });
                }

                if (value % a === 0) {
                    const inner = value / a - variableValue;

                    if (Math.abs(inner) >= 1 && Math.abs(inner) <= constantMax) {
                        specs.push({
                            face: `${formatNumber(a)}(${variable}${formatSignedTerm(inner)})`,
                            value,
                            kind: "expression",
                            canonical: { a, b: a * inner },
                            templateId: "expression-a-times-x-plus-b"
                        });
                    }
                }
            }
        }

        const expressions = specs.filter(spec => spec.kind === "expression");
        const numbers = specs.filter(spec => spec.kind === "number");

        if (wantExpression && expressions.length > 0) {
            return randomChoice(expressions);
        }

        if (!wantExpression && numbers.length > 0) {
            return numbers[0];
        }

        return randomChoice(specs);
    }

    function forwardExpressionValue(variableValue, variable, gradeBand) {
        const templates = gradeBand === "3-5"
            ? ["ax", "x-plus", "x-minus"]
            : ["ax", "x-plus", "x-minus", "ax-plus-b", "group"];

        const template = randomChoice(templates);
        const coefficientMax = gradeBand === "3-5" ? 9 : 12;
        let canonical;
        let face;
        let templateId;

        if (template === "ax") {
            const a = randomInteger(2, coefficientMax);
            canonical = { a, b: 0 };
            face = canonicalFace(a, 0, variable);
            templateId = "expression-ax";
        } else if (template === "x-plus" || template === "x-minus") {
            const amount = randomInteger(2, coefficientMax);
            const b = template === "x-plus" ? amount : -amount;
            canonical = { a: 1, b };
            face = canonicalFace(1, b, variable);
            templateId = "expression-x-plus-constant";
        } else if (template === "ax-plus-b") {
            const a = randomInteger(2, coefficientMax);
            const b = randomInteger(1, coefficientMax) * randomChoice([1, -1]);
            canonical = { a, b };
            face = canonicalFace(a, b, variable);
            templateId = "expression-ax-plus-b";
        } else {
            const a = randomInteger(2, coefficientMax);
            const inner = randomInteger(1, coefficientMax) * randomChoice([1, -1]);
            canonical = { a, b: a * inner };
            face = `${formatNumber(a)}(${variable}${formatSignedTerm(inner)})`;
            templateId = "expression-a-times-x-plus-b";
        }

        return {
            face,
            value: evaluateCanonical(canonical, variableValue),
            kind: "expression",
            canonical,
            templateId
        };
    }

    function combinationSets(combinations) {
        const sets = new Map();

        combinations.forEach(combo => {
            const indexes = [
                ...(combo.addendIndexes || combo.operandIndexes || []),
                combo.resultIndex
            ].sort((a, b) => a - b);
            const key = indexes.join(",");

            if (!sets.has(key)) {
                sets.set(key, { indexes, combinations: [] });
            }

            sets.get(key).combinations.push(combo);
        });

        return [...sets.values()];
    }

    function evaluateSolutionFromValues(values, operation) {
        const combinations = puzzleEngine.findCombinations(
            values,
            2,
            [],
            operation
        );

        const sets = combinationSets(combinations);

        return {
            combinations,
            sets
        };
    }

    function buildEvaluateRound(settings, example = null) {
        const round = baseRound(settings, "evaluate");
        const operation = settings.operation;
        const variable = example?.variable?.name || randomChoice(
            settings.gradeBand === "6-8" ? ["x", "x", "n", "m"] : ["x"]
        );

        let variableValue = example?.variable?.value ?? (
            settings.gradeBand === "3-5"
                ? randomInteger(2, 9)
                : settings.allowNegatives
                    ? randomChoice([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
                    : randomInteger(2, 12)
        );

        round.variable = { name: variable, value: variableValue };
        round.banner = {
            kind: "variable",
            text: `${variable} = ${formatNumber(variableValue)}`,
            label: "Evaluate Expressions"
        };

        let tileSpecs;

        if (example) {
            tileSpecs = example.tiles.map(tile => ({ ...tile }));
        } else {
            const valueLimit = settings.gradeBand === "3-5" ? 100 : 144;
            const valueFloor = settings.allowNegatives ? -20 : 1;
            let first;
            let secondValue;
            let resultValue;

            if (operation === "division") {
                // Construct the dividend tile directly from a valid
                // division, with the variable chosen so the dividend
                // can be shown as a coefficient times the variable.
                const divisor = randomInteger(2, 12);
                const quotient = randomInteger(2, 12);
                const dividend = divisor * quotient;
                const coefficientOptions = [];

                for (let a = 2; a <= 12; a += 1) {
                    if (dividend % a === 0) {
                        const candidateVariableValue = dividend / a;

                        if (
                            candidateVariableValue >= 2 &&
                            candidateVariableValue <= (settings.gradeBand === "3-5" ? 9 : 12)
                        ) {
                            coefficientOptions.push(a);
                        }
                    }
                }

                if (coefficientOptions.length === 0) {
                    throw new Error("Evaluate division could not be constructed.");
                }

                const coefficient = randomChoice(coefficientOptions);
                const divisionVariableValue = dividend / coefficient;

                // The round's announced variable must be the one the
                // faces were built around; division fixes it here.
                variableValue = divisionVariableValue;
                round.variable = { name: variable, value: variableValue };
                round.banner.text = `${variable} = ${formatNumber(variableValue)}`;
                first = {
                    face: canonicalFace(coefficient, 0, variable),
                    value: dividend,
                    kind: "expression",
                    canonical: { a: coefficient, b: 0 },
                    templateId: "expression-ax"
                };
                secondValue = divisor;
                resultValue = quotient;
            } else {
                first = forwardExpressionValue(
                    variableValue,
                    variable,
                    settings.gradeBand
                );

                for (let attempt = 0; attempt < 300; attempt += 1) {
                    if (operation === "addition") {
                        secondValue = randomInteger(2, 30);
                        resultValue = first.value + secondValue;
                    } else if (operation === "subtraction") {
                        secondValue = randomInteger(2, 30);
                        resultValue = first.value - secondValue;
                    } else {
                        secondValue = randomInteger(2, 9);
                        resultValue = first.value * secondValue;
                    }

                    if (
                        resultValue >= valueFloor &&
                        resultValue <= valueLimit &&
                        secondValue >= valueFloor &&
                        secondValue <= valueLimit &&
                        new Set([first.value, secondValue, resultValue]).size === 3
                    ) {
                        break;
                    }

                    secondValue = undefined;
                }

                if (secondValue === undefined || resultValue === undefined) {
                    throw new Error("Evaluate solution could not be constructed.");
                }
            }

            const second = expressionSpecForValue(
                secondValue,
                variableValue,
                variable,
                settings.gradeBand,
                Math.random() < 0.45
            );

            const result = expressionSpecForValue(
                resultValue,
                variableValue,
                variable,
                settings.gradeBand,
                Math.random() < 0.35
            );

            tileSpecs = [first, second, result];

            const intendedFaces = new Set(tileSpecs.map(spec => spec.face));
            const intendedValues = new Set(tileSpecs.map(spec => spec.value));
            const valueFloorPool = settings.allowNegatives ? -20 : 1;
            const valueCeilingPool = settings.gradeBand === "3-5" ? 100 : 144;
            const poolValues = shuffle(
                Array.from(
                    { length: valueCeilingPool - valueFloorPool + 1 },
                    (_, index) => valueFloorPool + index
                ).filter(value => !intendedValues.has(value))
            );

            for (const value of poolValues) {
                if (tileSpecs.length >= round.boardSize) {
                    break;
                }

                const spec = expressionSpecForValue(
                    value,
                    variableValue,
                    variable,
                    settings.gradeBand,
                    Math.random() < 0.5
                );

                if (intendedFaces.has(spec.face)) {
                    continue;
                }

                // Only combinations involving the candidate (as an
                // operand or as the result) can be new, so check
                // those directly instead of re-solving the whole
                // board for every candidate filler.
                const existingValues = tileSpecs.map(tile => tile.value);
                let createsExtraSolution = false;

                for (let index = 0; index < existingValues.length; index += 1) {
                    const existing = existingValues[index];
                    const forward = puzzleEngine.computeResult(
                        [existing, spec.value],
                        operation
                    );
                    const reverse = puzzleEngine.computeResult(
                        [spec.value, existing],
                        operation
                    );

                    if (
                        forward === spec.value ||
                        reverse === spec.value ||
                        existingValues.includes(forward) ||
                        existingValues.includes(reverse)
                    ) {
                        createsExtraSolution = true;
                        break;
                    }
                }

                if (!createsExtraSolution) {
                    for (let first = 0; first < existingValues.length; first += 1) {
                        for (let second = 0; second < existingValues.length; second += 1) {
                            if (first === second) continue;

                            const result = puzzleEngine.computeResult(
                                [existingValues[first], existingValues[second]],
                                operation
                            );

                            if (result === spec.value) {
                                createsExtraSolution = true;
                                break;
                            }
                        }

                        if (createsExtraSolution) break;
                    }
                }

                if (createsExtraSolution) {
                    continue;
                }

                tileSpecs.push(spec);
                intendedFaces.add(spec.face);
            }

            if (tileSpecs.length !== round.boardSize) {
                throw new Error("Evaluate board could not be filled safely.");
            }

            const expressionCount = tileSpecs.filter(
                spec => spec.kind === "expression"
            ).length;

            if (expressionCount < Math.ceil(round.boardSize / 2)) {
                for (let index = 0; index < tileSpecs.length; index += 1) {
                    if (tileSpecs[index].kind === "expression") {
                        continue;
                    }

                    const replacement = expressionSpecForValue(
                        tileSpecs[index].value,
                        variableValue,
                        variable,
                        settings.gradeBand,
                        true
                    );

                    if (
                        replacement.kind === "expression" &&
                        !tileSpecs.some(
                            (spec, specIndex) => specIndex !== index && spec.face === replacement.face
                        )
                    ) {
                        tileSpecs[index] = replacement;
                    }

                    if (tileSpecs.filter(spec => spec.kind === "expression").length >= Math.ceil(round.boardSize / 2)) {
                        break;
                    }
                }
            }

            tileSpecs = shuffle(tileSpecs);
        }

        round.tiles = tileSpecs.map(spec => makeTile(
            spec.face,
            spec.value,
            spec.kind,
            {
                canonical: spec.canonical || null,
                templateId: spec.templateId || null,
                errorPatternId: spec.errorPatternId || null
            }
        ));

        const values = round.tiles.map(tile => tile.value);
        const { combinations, sets } = evaluateSolutionFromValues(
            values,
            operation
        );

        if (sets.length !== 1) {
            throw new Error("Evaluate board does not have exactly one solution set.");
        }

        const solutionSet = sets[0];
        const primaryCombo = solutionSet.combinations[0];

        round.solution = {
            type: "combo",
            indexes: solutionSet.indexes,
            operandIndexes: [...primaryCombo.addendIndexes],
            resultIndex: primaryCombo.resultIndex,
            combinations: solutionSet.combinations,
            faceEquation: buildEvaluateEquation(
                round,
                primaryCombo
            ).faceEquation,
            valueEquation: buildEvaluateEquation(
                round,
                primaryCombo
            ).valueEquation
        };

        round.templateId = "evaluate-hunt";
        round.feedback = {
            strike: round.solution.faceEquation +
                ` → ${round.solution.valueEquation}`,
            reveal: round.solution.faceEquation +
                ` → ${round.solution.valueEquation}`,
            sayIt: round.solution.faceEquation
        };

        return finishRound(round);
    }

    function buildEvaluateEquation(round, combo) {
        const symbol = puzzleEngine.getOperation(round.operation).symbol;
        const operandFaces = combo.addendIndexes.map(index => (
            operandFace(round.tiles[index].face)
        ));
        const resultFace = round.tiles[combo.resultIndex].face;

        return {
            faceEquation: `${operandFaces.join(` ${symbol} `)} = ${resultFace}`,
            valueEquation: combo.equation.replace(/-/g, "−")
        };
    }

    /*
    ================================================================
    Solve for x
    ================================================================
    */

    function solveEquationValue(question, candidate) {
        switch (question.templateId) {
            case "solve-add":
                return candidate + question.a;
            case "solve-subtract":
                return candidate - question.a;
            case "solve-subtrahend":
                return question.a - candidate;
            case "solve-multiply":
                return question.a * candidate;
            case "solve-divide":
                return candidate % question.a === 0
                    ? candidate / question.a
                    : null;
            case "solve-two-add":
                return question.a * candidate + question.b;
            case "solve-two-subtract":
                return question.a * candidate - question.b;
            case "solve-two-group":
                return question.a * (candidate + question.b);
            default:
                return null;
        }
    }

    function solveTarget(question) {
        return question.c ?? question.b;
    }

    function solveSubstitutionDisplay(question) {
        const solution = question.solution;
        const value = `(${formatNumber(solution)})`;

        switch (question.templateId) {
            case "solve-add":
                return `${formatNumber(solution)} + ${formatNumber(question.a)} = ${formatNumber(question.b)} ✓`;
            case "solve-subtract":
                return `${formatNumber(solution)} − ${formatNumber(question.a)} = ${formatNumber(question.b)} ✓`;
            case "solve-subtrahend":
                return `${formatNumber(question.a)} − ${formatNumber(solution)} = ${formatNumber(question.b)} ✓`;
            case "solve-multiply":
                return `${formatNumber(question.a)}${value} = ${formatNumber(question.b)} ✓`;
            case "solve-divide":
                return `${formatNumber(solution)} ÷ ${formatNumber(question.a)} = ${formatNumber(question.b)} ✓`;
            case "solve-two-add":
                return `${formatNumber(question.a)}${value} + ${formatNumber(question.b)} = ${formatNumber(question.c)} ✓`;
            case "solve-two-subtract":
                return `${formatNumber(question.a)}${value} − ${formatNumber(question.b)} = ${formatNumber(question.c)} ✓`;
            case "solve-two-group":
                return `${formatNumber(question.a)}(${formatNumber(solution)} + ${formatNumber(question.b)}) = ${formatNumber(question.c)} ✓`;
            default:
                return `${question.variable} = ${formatNumber(solution)} ✓`;
        }
    }

    function makeSolveQuestion(settings, example = null) {
        if (example) {
            return { ...example };
        }

        const band = settings.gradeBand;
        const variable = randomChoice(
            band === "6-8" ? ["x", "x", "x", "n", "m"] : ["x"]
        );
        const steps = band === "3-5"
            ? 1
            : settings.solveSteps === "one-step"
                ? 1
                : settings.solveSteps === "two-step"
                    ? 2
                    : randomChoice([1, 2]);

        const useNegatives = settings.allowNegatives && band === "6-8";
        let templateId;
        let a;
        let b;
        let c = null;
        let solution;

        if (steps === 1) {
            templateId = randomChoice([
                "solve-add",
                "solve-subtract",
                "solve-subtrahend",
                "solve-multiply",
                "solve-divide"
            ]);

            if (templateId === "solve-add") {
                solution = useNegatives
                    ? randomInteger(-20, 50)
                    : randomInteger(2, 50);
                a = useNegatives ? randomInteger(-20, 30) : randomInteger(2, 30);
                b = solution + a;
            } else if (templateId === "solve-subtract") {
                solution = useNegatives
                    ? randomInteger(-20, 50)
                    : randomInteger(2, 50);
                a = randomInteger(2, 30);
                b = solution - a;
            } else if (templateId === "solve-subtrahend") {
                solution = randomInteger(2, 50);
                b = useNegatives ? randomInteger(-20, 40) : randomInteger(2, 40);
                a = solution + b;
            } else if (templateId === "solve-multiply") {
                a = randomInteger(2, 12);
                solution = useNegatives
                    ? randomInteger(-12, 12) || 3
                    : randomInteger(2, 20);
                b = a * solution;
            } else {
                a = randomInteger(2, 12);
                b = randomInteger(2, Math.max(2, Math.floor(50 / a)));
                solution = a * b;
            }
        } else {
            templateId = randomChoice([
                "solve-two-add",
                "solve-two-subtract",
                "solve-two-group"
            ]);

            a = randomInteger(2, templateId === "solve-two-group" ? 9 : 12);
            solution = useNegatives
                ? randomInteger(-15, 35)
                : randomInteger(2, 40);
            b = randomInteger(2, 25);

            if (templateId === "solve-two-add") {
                c = a * solution + b;
            } else if (templateId === "solve-two-subtract") {
                c = a * solution - b;
            } else {
                c = a * (solution + b);
            }
        }

        let display;
        let lhsFace;

        switch (templateId) {
            case "solve-add":
                lhsFace = `${variable} + ${formatNumber(a)}`;
                display = `${lhsFace} = ${formatNumber(b)}`;
                break;
            case "solve-subtract":
                lhsFace = `${variable} − ${formatNumber(a)}`;
                display = `${lhsFace} = ${formatNumber(b)}`;
                break;
            case "solve-subtrahend":
                lhsFace = `${formatNumber(a)} − ${variable}`;
                display = `${lhsFace} = ${formatNumber(b)}`;
                break;
            case "solve-multiply":
                lhsFace = `${formatNumber(a)}${variable}`;
                display = `${lhsFace} = ${formatNumber(b)}`;
                break;
            case "solve-divide":
                lhsFace = `${variable} ÷ ${formatNumber(a)}`;
                display = `${lhsFace} = ${formatNumber(b)}`;
                break;
            case "solve-two-add":
                lhsFace = `${formatNumber(a)}${variable} + ${formatNumber(b)}`;
                display = `${lhsFace} = ${formatNumber(c)}`;
                break;
            case "solve-two-subtract":
                lhsFace = `${formatNumber(a)}${variable} − ${formatNumber(b)}`;
                display = `${lhsFace} = ${formatNumber(c)}`;
                break;
            default:
                lhsFace = `${formatNumber(a)}(${variable} + ${formatNumber(b)})`;
                display = `${lhsFace} = ${formatNumber(c)}`;
        }

        return {
            kind: "solve",
            templateId,
            variable,
            steps,
            a,
            b,
            c,
            solution,
            display,
            lhsFace
        };
    }

    function solvePatternFeedback(question, patternId, value) {
        const variable = question.variable;

        switch (patternId) {
            case "wrong-operation":
                if (question.templateId === "solve-add") {
                    return `You added — to undo +${formatNumber(question.a)}, subtract.`;
                }
                if (question.templateId === "solve-subtract") {
                    return `You subtracted — to undo −${formatNumber(question.a)}, add.`;
                }
                return "That choice undoes the equation with the wrong operation.";
            case "sign-slip":
                return "Watch the sign: the answer has to make the target value, negative included.";
            case "stopped-halfway":
                return question.templateId === "solve-two-group"
                    ? `That's ${variable} + ${formatNumber(question.b)}, not ${variable} — one more step.`
                    : `That's ${formatNumber(question.a)}${variable}, not ${variable} — one more step.`;
            case "wrong-operation-step-one":
                return question.templateId === "solve-two-subtract"
                    ? `To undo −${formatNumber(question.b)}, add ${formatNumber(question.b)} — then divide.`
                    : "The first undo used the wrong operation — fix that step, then divide.";
            case "divided-by-wrong-number":
                return `Divide by the number on ${variable}.`;
            case "arithmetic-slip":
                return "Right idea — check the arithmetic.";
            case "copied-number":
                return "That number is already in the equation — it's not the answer.";
            default:
                return `${formatNumber(value)} does not make ${question.display} true. Try undoing one operation at a time.`;
        }
    }

    function solveDistractorCandidates(question, settings) {
        const solution = question.solution;
        const candidates = [];
        const seen = new Set([solution]);

        function add(value, errorPatternId) {
            if (
                Number.isInteger(value) &&
                value !== solution &&
                value >= -20 &&
                value <= 200 &&
                !seen.has(value) &&
                solveEquationValue(question, value) !== solveTarget(question)
            ) {
                seen.add(value);
                candidates.push({ value, errorPatternId });
            }
        }

        if (question.steps === 1) {
            let wrongOperation;

            switch (question.templateId) {
                case "solve-add":
                    wrongOperation = question.b + question.a;
                    break;
                case "solve-subtract":
                    wrongOperation = question.b - question.a;
                    break;
                case "solve-subtrahend":
                    wrongOperation = question.a + question.b;
                    break;
                case "solve-multiply":
                    wrongOperation = question.b * question.a;
                    break;
                default:
                    wrongOperation = question.b % question.a === 0
                        ? question.b / question.a
                        : question.b - question.a;
            }

            add(wrongOperation, "wrong-operation");
            add(question.a, "copied-number");
            add(question.b, "copied-number");
            add(-solution, "sign-slip");
        } else {
            if (question.templateId === "solve-two-add") {
                add(question.c - question.b, "stopped-halfway");
                add(
                    (question.c + question.b) % question.a === 0
                        ? (question.c + question.b) / question.a
                        : question.c + question.b,
                    "wrong-operation-step-one"
                );
                add(
                    (question.c - question.b) % question.b === 0
                        ? (question.c - question.b) / question.b
                        : question.c,
                    "divided-by-wrong-number"
                );
            } else if (question.templateId === "solve-two-subtract") {
                add(question.c + question.b, "stopped-halfway");
                add(
                    (question.c - question.b) % question.a === 0
                        ? (question.c - question.b) / question.a
                        : question.c - question.b,
                    "wrong-operation-step-one"
                );
                add(
                    (question.c + question.b) % question.b === 0
                        ? (question.c + question.b) / question.b
                        : question.c,
                    "divided-by-wrong-number"
                );
            } else {
                add(question.c / question.a, "stopped-halfway");
                add(question.c / question.a + question.b, "wrong-operation-step-one");
                add(
                    question.c % question.b === 0
                        ? question.c / question.b - question.b
                        : question.c - question.b,
                    "divided-by-wrong-number"
                );
            }

            add(question.a, "copied-number");
            add(question.b, "copied-number");
            add(question.c, "copied-number");
            add(-solution, "sign-slip");
        }

        add(solution + 1, "arithmetic-slip");
        add(solution - 1, "arithmetic-slip");
        add(solution + 2, "arithmetic-slip");
        add(solution - 2, "arithmetic-slip");
        add(solution + 10, "arithmetic-slip");
        add(solution - 10, "arithmetic-slip");

        const pool = [];

        for (let value = -20; value <= 200; value += 1) {
            if (!seen.has(value)) {
                pool.push(value);
            }
        }

        pool.sort((left, right) => (
            Math.abs(left - solution) - Math.abs(right - solution)
        ));

        pool.forEach(value => add(value, "arithmetic-slip"));

        return candidates.filter(candidate => (
            settings.allowNegatives || candidate.value >= 0
        ));
    }

    function buildSolveRound(settings, example = null) {
        const question = makeSolveQuestion(settings, example?.question);
        const round = baseRound(settings, "solve");

        round.question = question;
        round.templateId = question.templateId;
        round.variable = {
            name: question.variable,
            value: null
        };
        round.banner = {
            kind: "equation",
            text: question.display,
            label: "Solve for x"
        };

        const candidates = example?.board
            ? example.board.map(value => {
                const known = (example.patterns || {})[String(value)];

                return {
                    value,
                    errorPatternId: value === question.solution
                        ? null
                        : known || "designed-distractor"
                };
            })
            : [
                { value: question.solution, errorPatternId: null },
                ...solveDistractorCandidates(question, settings)
            ];

        const chosen = example?.board
            ? candidates
            : pickBoardCandidates(candidates, round.boardSize);

        if (chosen.length !== round.boardSize) {
            throw new Error("Solve board could not be filled.");
        }

        const ordered = example?.board ? chosen : shuffle(chosen);

        round.tiles = ordered.map(candidate => {
            const tile = makeTile(
                formatNumber(candidate.value),
                candidate.value,
                "candidate",
                {
                    templateId: question.templateId,
                    errorPatternId: candidate.errorPatternId
                }
            );

            if (candidate.value !== question.solution) {
                tile.missFeedback = solvePatternFeedback(
                    question,
                    candidate.errorPatternId,
                    candidate.value
                );
            }

            return tile;
        });

        const solutionIndex = round.tiles.findIndex(
            tile => tile.value === question.solution
        );
        const check = solveSubstitutionDisplay(question);

        round.solution = {
            type: "single",
            indexes: [solutionIndex],
            resultIndex: solutionIndex,
            faceEquation: `${question.variable} = ${formatNumber(question.solution)}`,
            valueEquation: check,
            reasoning: check
        };

        round.feedback = {
            strike: check,
            reveal: check,
            sayIt: `${question.variable} equals ${formatNumber(question.solution)}`
        };

        return finishRound(round);
    }

    /*
    ================================================================
    Equivalent Expressions
    ================================================================
    */

    function equivalentTile(face, canonical, templateId, errorPatternId, property) {
        return {
            face,
            value: null,
            kind: "expression",
            canonical: { ...canonical },
            templateId,
            errorPatternId: errorPatternId || null,
            property: property || null
        };
    }

    function chooseEquivalentSpotCheck(tiles) {
        const candidates = [4, 3, 2, 5, 6, -2, -3, 7];

        for (const spot of candidates) {
            const values = tiles.map(tile => (
                evaluateCanonical(tile.canonical, spot)
            ));
            const counts = new Map();

            values.forEach(value => {
                counts.set(value, (counts.get(value) || 0) + 1);
            });

            const duplicateCounts = [...counts.values()].filter(
                count => count > 1
            );

            if (
                duplicateCounts.length === 1 &&
                duplicateCounts[0] === 2
            ) {
                return spot;
            }
        }

        throw new Error("No separating spot-check value found.");
    }

    function buildEquivalentRound(settings, example = null) {
        const round = baseRound(settings, "equivalent");
        const variable = example?.variable || "x";
        let specs;
        let property;
        let propertyReason;
        let templateId;

        if (example) {
            specs = example.tiles.map(tile => ({ ...tile }));
            property = example.property;
            propertyReason = example.propertyReason;
            templateId = example.templateId;
        } else if (settings.gridSize <= 3 && Math.random() < 0.5) {
            const p = randomInteger(2, 9);
            const q = randomInteger(2, 9);
            const constant = randomInteger(1, 12);
            const canonical = { a: p + q, b: constant };

            property = "Combining Like Terms";
            propertyReason =
                `${formatNumber(p)}${variable} + ${formatNumber(q)}${variable} makes ${formatNumber(p + q)}${variable}; the constant stays ${formatNumber(constant)}`;
            templateId = "equivalent-combining-like-terms";
            specs = [
                equivalentTile(
                    `${formatNumber(p)}${variable} + ${formatNumber(constant)} + ${formatNumber(q)}${variable}`,
                    canonical,
                    templateId,
                    null,
                    property
                ),
                equivalentTile(
                    canonicalFace(canonical.a, canonical.b, variable),
                    canonical,
                    templateId,
                    null,
                    property
                ),
                equivalentTile(
                    canonicalFace(canonical.a, constant + q, variable),
                    { a: canonical.a, b: constant + q },
                    templateId,
                    "folded-constant-into-constant"
                ),
                equivalentTile(
                    canonicalFace(canonical.a + constant, 0, variable),
                    { a: canonical.a + constant, b: 0 },
                    templateId,
                    "added-everything-into-one-term"
                )
            ];
        } else {
            const negativeDistributive = settings.allowNegatives && Math.random() < 0.35;
            const a = negativeDistributive
                ? -randomInteger(2, 6)
                : randomInteger(2, 6);
            const inner = randomInteger(1, Math.max(1, Math.floor(12 / Math.abs(a))));
            const canonical = { a, b: a * inner };

            property = "Distributive Property";
            propertyReason =
                `${formatNumber(a)}(${variable}${formatSignedTerm(inner)}) spreads the ${formatNumber(a)} over both terms`;
            templateId = negativeDistributive
                ? "equivalent-distributive-negative"
                : "equivalent-distributive";
            specs = [
                equivalentTile(
                    `${formatNumber(a)}(${variable}${formatSignedTerm(inner)})`,
                    canonical,
                    templateId,
                    null,
                    property
                ),
                equivalentTile(
                    canonicalFace(canonical.a, canonical.b, variable),
                    canonical,
                    templateId,
                    null,
                    property
                ),
                equivalentTile(
                    canonicalFace(a, inner, variable),
                    { a, b: inner },
                    templateId,
                    "distributed-to-first-term-only"
                ),
                equivalentTile(
                    canonicalFace(1, canonical.b, variable),
                    { a: 1, b: canonical.b },
                    templateId,
                    "multiplier-fell-off"
                )
            ];
        }

        const usedCanonical = new Map();

        specs.forEach(spec => {
            const key = `${spec.canonical.a},${spec.canonical.b}`;
            usedCanonical.set(key, (usedCanonical.get(key) || 0) + 1);
        });

        let extraIndex = 0;

        while (specs.length < round.boardSize) {
            const a = randomInteger(2, 12);
            const b = randomInteger(
                settings.allowNegatives ? -12 : 1,
                12
            );
            const key = `${a},${b}`;

            if (usedCanonical.has(key)) {
                continue;
            }

            usedCanonical.set(key, 1);
            specs.push(equivalentTile(
                canonicalFace(a, b, variable),
                { a, b },
                "equivalent-extra-expression",
                "unrelated-expression"
            ));
            extraIndex += 1;

            if (extraIndex > 500) {
                throw new Error("Equivalent board could not be filled.");
            }
        }

        specs = example ? specs : shuffle(specs);

        round.tiles = specs.map(spec => makeTile(
            spec.face,
            null,
            "expression",
            {
                canonical: spec.canonical,
                templateId: spec.templateId,
                errorPatternId: spec.errorPatternId
            }
        ));

        const canonicalCounts = new Map();

        round.tiles.forEach((tile, index) => {
            const key = `${tile.canonical.a},${tile.canonical.b}`;

            if (!canonicalCounts.has(key)) {
                canonicalCounts.set(key, []);
            }

            canonicalCounts.get(key).push(index);
        });

        const pairEntry = [...canonicalCounts.entries()].find(
            ([, indexes]) => indexes.length === 2
        );

        if (!pairEntry) {
            throw new Error("Equivalent board has no intended pair.");
        }

        const pairIndexes = pairEntry[1];
        const spotCheck = example?.spotCheck ?? chooseEquivalentSpotCheck(round.tiles);
        const pairValue = evaluateCanonical(
            round.tiles[pairIndexes[0]].canonical,
            spotCheck
        );

        round.question = {
            kind: "equivalent",
            variable,
            spotCheck,
            property,
            propertyReason
        };
        round.templateId = templateId;
        round.banner = {
            kind: "instruction",
            text: "Find the two expressions that are equivalent — worth the same for every x.",
            label: "Equivalent Expressions"
        };

        const pairFaces = pairIndexes.map(index => round.tiles[index].face);

        round.solution = {
            type: "pair",
            indexes: pairIndexes,
            resultIndex: null,
            faceEquation: `${pairFaces[0]} = ${pairFaces[1]}`,
            valueEquation: `${formatNumber(pairValue)} = ${formatNumber(pairValue)}`,
            reasoning: `${property}: ${propertyReason}. Check with ${variable} = ${formatNumber(spotCheck)}: ${pairFaces[0]} = ${formatNumber(pairValue)} and ${pairFaces[1]} = ${formatNumber(pairValue)} ✓.`
        };

        round.feedback = {
            strike: round.solution.reasoning,
            reveal: round.solution.reasoning,
            sayIt: round.solution.faceEquation
        };

        return finishRound(round);
    }

    /*
    ================================================================
    Verification and checking
    ================================================================
    */

    function verifyAlgebraRound(round) {
        const errors = [];

        if (!round || round.content !== "algebra") {
            return { valid: false, errors: ["round is not algebra"] };
        }

        const boardSize = normalizeGridSize(round.gridSize) ** 2;

        if (!Array.isArray(round.tiles) || round.tiles.length !== boardSize) {
            errors.push("tile count does not match grid size");
            return { valid: false, errors };
        }

        const faces = round.tiles.map(tile => tile.face);

        if (new Set(faces).size !== faces.length) {
            errors.push("duplicate tile faces");
        }

        if (!round.solution || !Array.isArray(round.solution.indexes)) {
            errors.push("missing solution");
            return { valid: false, errors };
        }

        if (round.skill === "missing-number") {
            const values = round.tiles.map(tile => tile.value);

            if (new Set(values).size !== values.length) {
                errors.push("Missing Number candidate values are not distinct");
            }

            const satisfying = round.tiles.filter(tile => (
                missingEquationValue(round.question, tile.value) ===
                missingTarget(round.question)
            ));

            if (satisfying.length !== 1 || satisfying[0].value !== round.question.solution) {
                errors.push("Missing Number does not have exactly one satisfying candidate");
            }

            if (round.gradeBand === "k-2" && /[A-Za-z]/.test(round.question.unknownSymbol)) {
                errors.push("K-2 Missing Number used a letter unknown");
            }
        }

        if (round.skill === "evaluate") {
            const values = round.tiles.map(tile => tile.value);

            if (!values.every(Number.isFinite)) {
                errors.push("Evaluate tile without a finite value");
            } else {
                const { sets } = evaluateSolutionFromValues(
                    values,
                    round.operation
                );

                if (sets.length !== 1) {
                    errors.push("Evaluate does not have exactly one solution set");
                } else if (!sets[0].indexes.some(index => round.tiles[index].kind === "expression")) {
                    errors.push("Evaluate solution set contains no expression tile");
                }
            }

            if (!round.variable || !Number.isFinite(round.variable.value)) {
                errors.push("Evaluate variable value missing");
            }
        }

        if (round.skill === "solve") {
            const values = round.tiles.map(tile => tile.value);

            if (new Set(values).size !== values.length) {
                errors.push("Solve candidate values are not distinct");
            }

            const satisfying = round.tiles.filter(tile => (
                solveEquationValue(round.question, tile.value) ===
                solveTarget(round.question)
            ));

            if (satisfying.length !== 1 || satisfying[0].value !== round.question.solution) {
                errors.push("Solve does not have exactly one satisfying candidate");
            }

            if (round.gradeBand === "3-5" && round.question.steps !== 1) {
                errors.push("3-5 Solve generated a two-step equation");
            }

            if (round.solveSteps === "one-step" && round.question.steps !== 1) {
                errors.push("Steps knob one-step generated a two-step equation");
            }

            if (round.solveSteps === "two-step" && round.gradeBand === "6-8" && round.question.steps !== 2) {
                errors.push("Steps knob two-step generated a one-step equation");
            }
        }

        if (round.skill === "equivalent") {
            const counts = new Map();

            round.tiles.forEach(tile => {
                if (!tile.canonical) {
                    errors.push("Equivalent tile missing canonical form");
                    return;
                }

                const key = `${tile.canonical.a},${tile.canonical.b}`;
                counts.set(key, (counts.get(key) || 0) + 1);
            });

            const pairCounts = [...counts.values()].filter(count => count > 1);

            if (pairCounts.length !== 1 || pairCounts[0] !== 2) {
                errors.push("Equivalent board does not have exactly one canonical pair");
            }

            if (round.question?.spotCheck !== undefined) {
                const values = round.tiles.map(tile => (
                    evaluateCanonical(tile.canonical, round.question.spotCheck)
                ));
                const valueCounts = new Map();

                values.forEach(value => {
                    valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
                });

                const duplicates = [...valueCounts.values()].filter(count => count > 1);

                if (duplicates.length !== 1 || duplicates[0] !== 2) {
                    errors.push("Equivalent spot-check does not separate pair from near-misses");
                }
            }
        }

        if (!round.allowNegatives) {
            const negativeTile = round.tiles.some(tile => (
                (Number.isFinite(tile.value) && tile.value < 0) ||
                (tile.canonical && tile.canonical.a < 0) ||
                (round.skill === "equivalent" && tile.canonical && tile.canonical.b < 0)
            ));

            if (negativeTile) {
                errors.push("negative tile generated with Allow Negatives off");
            }

            if (
                round.question &&
                [round.question.a, round.question.b, round.question.c, round.question.solution]
                    .some(value => Number.isFinite(value) && value < 0)
            ) {
                errors.push("negative question value generated with Allow Negatives off");
            }

            if (round.variable && Number.isFinite(round.variable.value) && round.variable.value < 0) {
                errors.push("negative variable value generated with Allow Negatives off");
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function checkAlgebraSelection(round, selectedIndexes) {
        if (!round || !Array.isArray(selectedIndexes)) {
            return { correct: false, feedback: "No selection." };
        }

        const selected = [...selectedIndexes];

        if (round.skill === "missing-number" || round.skill === "solve") {
            if (selected.length !== 1) {
                return { correct: false, feedback: "Choose one tile." };
            }

            const tile = round.tiles[selected[0]];

            if (!tile) {
                return { correct: false, feedback: "That tile is not on the board." };
            }

            const correctValue = round.question.solution;

            if (tile.value === correctValue) {
                return {
                    correct: true,
                    indexes: [selected[0]],
                    resultIndex: selected[0],
                    display: round.skill === "solve"
                        ? round.feedback.strike
                        : `${round.solution.faceEquation} — ${round.feedback.strike}`,
                    feedback: round.feedback.strike,
                    errorPatternId: null
                };
            }

            return {
                correct: false,
                indexes: selected,
                resultIndex: null,
                display: tile.missFeedback || "That value does not make the equation true.",
                feedback: tile.missFeedback || "That value does not make the equation true.",
                errorPatternId: tile.errorPatternId || null,
                attemptedValue: tile.value
            };
        }

        if (round.skill === "evaluate") {
            if (selected.length !== 2) {
                return { correct: false, feedback: "Choose two tiles." };
            }

            const values = round.tiles.map(tile => tile.value);
            const combo = puzzleEngine.findComboForOperation(
                values,
                selected,
                2,
                [],
                round.operation
            );

            if (combo) {
                const equations = buildEvaluateEquation(round, combo);

                return {
                    correct: true,
                    indexes: [...selected, combo.resultIndex],
                    operandIndexes: [...selected],
                    resultIndex: combo.resultIndex,
                    combo,
                    display: `${equations.faceEquation} → ${equations.valueEquation}`,
                    feedback: `${equations.faceEquation} → ${equations.valueEquation}`,
                    errorPatternId: null
                };
            }

            const selectedValues = selected.map(index => round.tiles[index].value);
            const result = puzzleEngine.computeResult(
                selectedValues,
                round.operation
            );
            const symbol = puzzleEngine.getOperation(round.operation).symbol;
            const faceText = selected.map(index => operandFace(round.tiles[index].face)).join(` ${symbol} `);
            const valueText = selectedValues.map(formatNumber).join(` ${symbol} `);
            let feedback;

            if (result === null) {
                feedback = `${faceText} does not divide exactly. Check your values: ${valueText}.`;
            } else {
                const resultIndex = values.indexOf(result);

                if (resultIndex >= 0 && !selected.includes(resultIndex)) {
                    feedback = `${valueText} = ${formatNumber(result)} is on the board — check the click order and the tile you chose as the target.`;
                } else {
                    feedback = `${faceText} → ${valueText} = ${formatNumber(result)} — ${formatNumber(result)} is not on the board. Check your values again.`;
                }
            }

            return {
                correct: false,
                indexes: selected,
                resultIndex: null,
                display: feedback,
                feedback,
                errorPatternId: "evaluate-miss",
                attemptedValue: result
            };
        }

        if (round.skill === "equivalent") {
            if (selected.length !== 2) {
                return { correct: false, feedback: "Choose two expression tiles." };
            }

            const [first, second] = selected.map(index => round.tiles[index]);

            if (
                first?.canonical &&
                second?.canonical &&
                first.canonical.a === second.canonical.a &&
                first.canonical.b === second.canonical.b
            ) {
                return {
                    correct: true,
                    indexes: [...selected],
                    resultIndex: null,
                    display: round.feedback.strike,
                    feedback: round.feedback.strike,
                    errorPatternId: null
                };
            }

            const spot = round.question.spotCheck;
            const firstValue = evaluateCanonical(first.canonical, spot);
            const secondValue = evaluateCanonical(second.canonical, spot);
            const feedback = `Not equivalent: with ${round.question.variable} = ${formatNumber(spot)}, ${first.face} = ${formatNumber(firstValue)} but ${second.face} = ${formatNumber(secondValue)}.`;

            return {
                correct: false,
                indexes: selected,
                resultIndex: null,
                display: feedback,
                feedback,
                errorPatternId: first.errorPatternId || second.errorPatternId || "not-equivalent",
                attemptedValue: null
            };
        }

        return { correct: false, feedback: "Unknown algebra skill." };
    }

    function getAlgebraReveal(round) {
        if (!round) {
            return null;
        }

        if (round.skill === "evaluate") {
            return {
                selectedIndexes: [...(round.solution.operandIndexes || [])],
                matchedIndexes: [...round.solution.indexes],
                resultIndex: round.solution.resultIndex,
                display: round.feedback.reveal
            };
        }

        return {
            selectedIndexes: round.skill === "equivalent"
                ? [...round.solution.indexes]
                : [...round.solution.indexes],
            matchedIndexes: [...round.solution.indexes],
            resultIndex: round.solution.resultIndex,
            display: round.feedback.reveal
        };
    }

    function roundUsesNegatives(round) {
        if (!round) {
            return false;
        }

        if (round.variable && Number.isFinite(round.variable.value) && round.variable.value < 0) {
            return true;
        }

        if (round.tiles.some(tile => (
            (Number.isFinite(tile.value) && tile.value < 0) ||
            (tile.canonical && tile.canonical.a < 0) ||
            (round.skill === "equivalent" && tile.canonical && tile.canonical.b < 0)
        ))) {
            return true;
        }

        if (round.question) {
            return [
                round.question.a,
                round.question.b,
                round.question.c,
                round.question.solution
            ].some(value => Number.isFinite(value) && value < 0);
        }

        return false;
    }

    function evaluateAlgebraBoardForSettings(round, options = {}) {
        const next = normalizeAlgebraSettings(options);

        if (!round || round.content !== "algebra") {
            return { playable: false, reason: "no-board", round: null };
        }

        if (next.gradeBand !== round.gradeBand) {
            return { playable: false, reason: "grade-band-change", round: null };
        }

        if (next.skill !== "mixed" && next.skill !== round.skill) {
            return { playable: false, reason: "skill-change", round: null };
        }

        if (
            round.skill === "solve" &&
            next.gradeBand === "6-8" &&
            ((next.solveSteps === "one-step" && round.question.steps !== 1) ||
                (next.solveSteps === "two-step" && round.question.steps !== 2))
        ) {
            return { playable: false, reason: "steps-change", round: null };
        }

        if (!next.allowNegatives && roundUsesNegatives(round)) {
            return { playable: false, reason: "illegal-negatives", round: null };
        }

        if (round.skill === "evaluate" && next.operation !== round.operation) {
            const values = round.tiles.map(tile => tile.value);
            const { sets } = evaluateSolutionFromValues(values, next.operation);

            if (sets.length !== 1) {
                return { playable: false, reason: "no-combination", round: null };
            }

            const kept = JSON.parse(JSON.stringify(round));
            const set = sets[0];
            const primaryCombo = set.combinations[0];

            kept.operation = next.operation;
            kept.solution = {
                ...kept.solution,
                indexes: set.indexes,
                operandIndexes: [...primaryCombo.addendIndexes],
                resultIndex: primaryCombo.resultIndex,
                combinations: set.combinations
            };

            const equations = buildEvaluateEquation(kept, primaryCombo);
            kept.solution.faceEquation = equations.faceEquation;
            kept.solution.valueEquation = equations.valueEquation;
            kept.feedback.strike = `${equations.faceEquation} → ${equations.valueEquation}`;
            kept.feedback.reveal = kept.feedback.strike;
            kept.feedback.sayIt = equations.faceEquation;
            kept.metadata.operation = next.operation;

            return { playable: true, reason: "playable", round: kept };
        }

        return { playable: true, reason: "playable", round };
    }

    function createAlgebraPuzzle(options = {}) {
        const settings = normalizeAlgebraSettings(options);
        const actualSkill = resolveActualSkill(settings);

        for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
            try {
                if (actualSkill === "missing-number") {
                    return buildMissingRound(settings);
                }

                if (actualSkill === "evaluate") {
                    return buildEvaluateRound(settings);
                }

                if (actualSkill === "solve") {
                    return buildSolveRound(settings);
                }

                if (actualSkill === "equivalent") {
                    return buildEquivalentRound(settings);
                }
            } catch (error) {
                if (attempt === MAX_GENERATION_ATTEMPTS - 1) {
                    throw error;
                }
            }
        }

        throw new Error("A valid algebra puzzle could not be generated.");
    }

    /*
    ================================================================
    Worked examples from ALGEBRA_MODE_DESIGN.md §§4–7
    ================================================================
    */

    function numberTile(face, value, kind = "number") {
        return {
            face: String(face),
            value,
            kind,
            canonical: null,
            templateId: kind === "candidate" ? "worked-example" : "number-tile"
        };
    }

    function expressionTile(face, value, canonical) {
        return {
            face,
            value,
            kind: "expression",
            canonical,
            templateId: "worked-example"
        };
    }

    function createAlgebraExample(exampleId) {
        const examples = {
            "missing-k2-add": () => buildMissingRound(
                normalizeAlgebraSettings({ skill: "missing-number", gradeBand: "k-2", gridSize: 2 }),
                {
                    question: {
                        kind: "missing-number",
                        templateId: "missing-add-start",
                        unknownSymbol: "□",
                        a: 7,
                        b: 12,
                        c: 12,
                        sign: "add",
                        solution: 5,
                        display: "□ + 7 = 12"
                    },
                    board: [5, 7, 9, 3]
                }
            ),
            "missing-k2-subtract": () => buildMissingRound(
                normalizeAlgebraSettings({ skill: "missing-number", gradeBand: "k-2", gridSize: 2 }),
                {
                    question: {
                        kind: "missing-number",
                        templateId: "missing-sub-start",
                        unknownSymbol: "★",
                        a: 4,
                        b: 9,
                        c: 9,
                        sign: "add",
                        solution: 13,
                        display: "★ − 4 = 9"
                    },
                    board: [13, 5, 9, 11]
                }
            ),
            "missing-factor": () => buildMissingRound(
                normalizeAlgebraSettings({ skill: "missing-number", gradeBand: "3-5", gridSize: 2 }),
                {
                    question: {
                        kind: "missing-number",
                        templateId: "missing-factor",
                        unknownSymbol: "□",
                        a: 4,
                        b: 28,
                        c: 28,
                        sign: "add",
                        solution: 7,
                        display: "4 × □ = 28"
                    },
                    board: [7, 6, 8, 4]
                }
            ),
            "missing-subtrahend": () => buildMissingRound(
                normalizeAlgebraSettings({ skill: "missing-number", gradeBand: "3-5", gridSize: 2 }),
                {
                    question: {
                        kind: "missing-number",
                        templateId: "missing-subtrahend",
                        unknownSymbol: "□",
                        a: 15,
                        b: 9,
                        c: 9,
                        sign: "add",
                        solution: 6,
                        display: "15 − □ = 9"
                    },
                    board: [6, 5, 9, 4]
                }
            ),
            "missing-two-part": () => buildMissingRound(
                normalizeAlgebraSettings({ skill: "missing-number", gradeBand: "3-5", gridSize: 2 }),
                {
                    question: {
                        kind: "missing-number",
                        templateId: "missing-two-part",
                        unknownSymbol: "□",
                        a: 3,
                        b: 2,
                        c: 20,
                        sign: "add",
                        solution: 6,
                        display: "3□ + 2 = 20"
                    },
                    board: [6, 5, 7, 4]
                }
            ),
            "evaluate-addition": () => buildEvaluateRound(
                normalizeAlgebraSettings({ skill: "evaluate", gradeBand: "3-5", gridSize: 2, operation: "addition" }),
                {
                    variable: { name: "x", value: 4 },
                    tiles: [
                        expressionTile("2x", 8, { a: 2, b: 0 }),
                        numberTile(3, 3),
                        numberTile(11, 11),
                        numberTile(6, 6)
                    ]
                }
            ),
            "evaluate-subtraction": () => buildEvaluateRound(
                normalizeAlgebraSettings({ skill: "evaluate", gradeBand: "6-8", gridSize: 2, operation: "subtraction" }),
                {
                    variable: { name: "x", value: 5 },
                    tiles: [
                        expressionTile("3x", 15, { a: 3, b: 0 }),
                        numberTile(4, 4),
                        numberTile(11, 11),
                        numberTile(9, 9)
                    ]
                }
            ),
            "evaluate-negatives": () => buildEvaluateRound(
                normalizeAlgebraSettings({ skill: "evaluate", gradeBand: "6-8", gridSize: 2, operation: "addition", allowNegatives: true }),
                {
                    variable: { name: "x", value: -2 },
                    tiles: [
                        expressionTile("2x + 1", -3, { a: 2, b: 1 }),
                        numberTile(5, 5),
                        numberTile(2, 2),
                        numberTile(4, 4)
                    ]
                }
            ),
            "solve-one-step": () => buildSolveRound(
                normalizeAlgebraSettings({ skill: "solve", gradeBand: "3-5", gridSize: 2, solveSteps: "one-step" }),
                {
                    question: {
                        kind: "solve",
                        templateId: "solve-add",
                        variable: "x",
                        steps: 1,
                        a: 9,
                        b: 17,
                        c: null,
                        solution: 8,
                        display: "x + 9 = 17",
                        lhsFace: "x + 9"
                    },
                    board: [8, 26, 9, 7],
                    patterns: { "26": "wrong-operation", "9": "copied-number", "7": "arithmetic-slip" }
                }
            ),
            "solve-two-step": () => buildSolveRound(
                normalizeAlgebraSettings({ skill: "solve", gradeBand: "6-8", gridSize: 2, solveSteps: "two-step" }),
                {
                    question: {
                        kind: "solve",
                        templateId: "solve-two-subtract",
                        variable: "x",
                        steps: 2,
                        a: 2,
                        b: 3,
                        c: 9,
                        solution: 6,
                        display: "2x − 3 = 9",
                        lhsFace: "2x − 3"
                    },
                    board: [6, 3, 12, 4],
                    patterns: { "3": "wrong-operation-step-one", "12": "stopped-halfway", "4": "divided-by-wrong-number" }
                }
            ),
            "solve-negatives": () => buildSolveRound(
                normalizeAlgebraSettings({ skill: "solve", gradeBand: "6-8", gridSize: 2, allowNegatives: true, solveSteps: "one-step" }),
                {
                    question: {
                        kind: "solve",
                        templateId: "solve-subtract",
                        variable: "x",
                        steps: 1,
                        a: 4,
                        b: -9,
                        c: null,
                        solution: -5,
                        display: "x − 4 = −9",
                        lhsFace: "x − 4"
                    },
                    board: [-5, -13, 5, -4],
                    patterns: { "-13": "wrong-operation", "5": "sign-slip", "-4": "copied-number" }
                }
            ),
            "equivalent-distributive": () => buildEquivalentRound(
                normalizeAlgebraSettings({ skill: "equivalent", gradeBand: "6-8", gridSize: 2 }),
                {
                    variable: "x",
                    templateId: "equivalent-distributive",
                    property: "Distributive Property",
                    propertyReason: "3(x + 2) spreads the 3 over both terms",
                    spotCheck: 4,
                    tiles: [
                        equivalentTile("3(x + 2)", { a: 3, b: 6 }, "equivalent-distributive", null, "Distributive Property"),
                        equivalentTile("3x + 6", { a: 3, b: 6 }, "equivalent-distributive", null, "Distributive Property"),
                        equivalentTile("3x + 2", { a: 3, b: 2 }, "equivalent-distributive", "distributed-to-first-term-only"),
                        equivalentTile("x + 6", { a: 1, b: 6 }, "equivalent-distributive", "multiplier-fell-off")
                    ]
                }
            ),
            "equivalent-combining": () => buildEquivalentRound(
                normalizeAlgebraSettings({ skill: "equivalent", gradeBand: "6-8", gridSize: 2 }),
                {
                    variable: "x",
                    templateId: "equivalent-combining-like-terms",
                    property: "Combining Like Terms",
                    propertyReason: "5x + 2x makes 7x; the constant stays 3",
                    spotCheck: 2,
                    tiles: [
                        equivalentTile("5x + 3 + 2x", { a: 7, b: 3 }, "equivalent-combining-like-terms", null, "Combining Like Terms"),
                        equivalentTile("7x + 3", { a: 7, b: 3 }, "equivalent-combining-like-terms", null, "Combining Like Terms"),
                        equivalentTile("7x + 5", { a: 7, b: 5 }, "equivalent-combining-like-terms", "folded-constant-into-constant"),
                        equivalentTile("10x", { a: 10, b: 0 }, "equivalent-combining-like-terms", "added-everything-into-one-term")
                    ]
                }
            )
        };

        if (!examples[exampleId]) {
            throw new Error(`Unknown algebra worked example: ${exampleId}`);
        }

        return examples[exampleId]();
    }

    const GRADE_BANDS = Object.freeze({
        "k-2": "Grades K–2",
        "3-5": "Grades 3–5",
        "6-8": "Grades 6–8"
    });

    function getSkillLabel(skill) {
        return SKILL_LABELS[skill] || SKILL_LABELS["missing-number"];
    }

    function getSkillDescription(skill) {
        return SKILL_DESCRIPTIONS[skill] || "";
    }

    function getBandRangeText(gradeBand) {
        return BAND_RANGE_TEXT[normalizeGradeBand(gradeBand)] || "";
    }

    function getSelectionCount(round) {
        if (!round || !round.solution) {
            return 2;
        }

        if (round.solution.type === "single") {
            return 1;
        }

        if (round.solution.type === "combo") {
            return (round.solution.operandIndexes || []).length || 2;
        }

        return 2;
    }

    global.OperationHuntAlgebraEngine = Object.freeze({
        CONTENT_IDS,
        GRADE_BAND_IDS,
        ALGEBRA_SKILL_IDS,
        ACTUAL_ALGEBRA_SKILL_IDS,
        SOLVE_STEP_IDS,
        SKILLS_BY_BAND,
        SKILL_LABELS,
        SKILL_DESCRIPTIONS,
        BAND_RANGE_TEXT,
        GRADE_BANDS,
        getSkillLabel,
        getSkillDescription,
        getBandRangeText,
        getSelectionCount,
        normalizeContent,
        normalizeGradeBand,
        normalizeAlgebraSkill,
        normalizeSolveSteps,
        getSkillsForBand,
        formatNumber,
        canonicalFace,
        evaluateCanonical,
        getFaceTier,
        normalizeAlgebraSettings,
        createAlgebraPuzzle,
        createAlgebraExample,
        verifyAlgebraRound,
        checkAlgebraSelection,
        getAlgebraReveal,
        evaluateAlgebraBoardForSettings,
        roundUsesNegatives
    });
})(window);
