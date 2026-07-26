"use strict";

(function connectProductionAudit() {
    const frame = document.querySelector("#audit-frame");
    const runButton = document.querySelector("#run-audit");
    const progress = document.querySelector("#audit-progress");
    const summary = document.querySelector("#audit-summary");
    const list = document.querySelector("#audit-results");

    if (!frame || !runButton || !progress || !summary || !list) {
        throw new Error("Release certification controls are missing.");
    }

    const configs = [
        [2, 2], [3, 2], [3, 3], [4, 2], [4, 3],
        [4, 4], [5, 2], [5, 3], [5, 4]
    ];
    const modes = {
        CLASSIC: "mode-classic",
        MAX_OUT: "mode-max-out",
        PRACTICE: "mode-practice"
    };
    const operations = {
        ADDITION: ["operation-addition", "+", "Show Running Sum"],
        SUBTRACTION: ["operation-subtraction", "−", "Show Running Difference"],
        MULTIPLICATION: ["operation-multiplication", "×", "Show Running Product"],
        DIVISION: ["operation-division", "÷", "Show Running Quotient"]
    };

    let appWindow;
    let appDocument;
    let engine;
    let results = [];

    const wait = milliseconds => new Promise(resolve => {
        window.setTimeout(resolve, milliseconds);
    });

    function record(name, passed, details = "") {
        results.push({ passed });
        const row = document.createElement("li");
        row.className = passed ? "pass" : "fail";
        const status = document.createElement("strong");
        status.textContent = passed ? "PASS" : "FAIL";
        const label = document.createElement("span");
        label.textContent = name;
        row.append(status, label);
        if (details) {
            const small = document.createElement("small");
            small.textContent = details;
            row.append(small);
        }
        list.append(row);
    }

    function element(selector) {
        const found = appDocument.querySelector(selector);
        if (!found) throw new Error(`Missing Demo element: ${selector}`);
        return found;
    }

    async function change(selector, value) {
        const control = element(selector);
        control.value = String(value);
        control.dispatchEvent(new appWindow.Event("change", { bubbles: true }));
        await wait(20);
    }

    async function check(selector, checked) {
        const control = element(selector);
        control.checked = checked;
        control.dispatchEvent(new appWindow.Event("change", { bubbles: true }));
        await wait(20);
    }

    async function click(selector, delay = 20) {
        element(selector).click();
        await wait(delay);
    }

    const cells = () => [...appDocument.querySelectorAll("#puzzle-board .puzzle-cell")];
    const numbers = () => cells().map(cell => Number(cell.textContent));
    const status = () => element("#session-status").textContent.trim();
    const attempts = () => Number(element("#total-attempts").textContent);
    const score = () => Number(appDocument.querySelector("#scoreboard .player-row span")?.textContent);

    function selections(length, count) {
        const output = [];
        function visit(current, used) {
            if (current.length === count) {
                output.push([...current]);
                return;
            }
            for (let index = 0; index < length; index += 1) {
                if (used.has(index)) continue;
                used.add(index);
                current.push(index);
                visit(current, used);
                current.pop();
                used.delete(index);
            }
        }
        visit([], new Set());
        return output;
    }

    function invalidSelection(operation, values, terms) {
        return selections(values.length, terms).find(indexes =>
            engine.findComboForSelection(
                operation, values, indexes, terms, []
            ) === null
        ) || null;
    }

    async function reloadDemo() {
        await new Promise((resolve, reject) => {
            const timeout = window.setTimeout(
                () => reject(new Error("Embedded Demo load timeout.")),
                10000
            );
            frame.addEventListener("load", () => {
                window.clearTimeout(timeout);
                resolve();
            }, { once: true });
            frame.src = `demo.html?production-audit=${Date.now()}`;
        });
        appWindow = frame.contentWindow;
        appDocument = frame.contentDocument;
        engine = appWindow.OperationHuntArithmeticEngine;
        if (!appDocument || !engine) throw new Error("Demo engine unavailable.");
        appWindow.confirm = () => true;
        appWindow.__auditAlerts = [];
        appWindow.alert = message => appWindow.__auditAlerts.push(String(message));
    }

    function auditStructure() {
        const selectors = [
            "#operation", "#game-mode", "#player-count", "#grid-size",
            "#required-addends", "#minimum-number", "#maximum-number",
            "#new-puzzle-button", "#reveal-button", "#previous-player-button",
            "#next-player-button", "#reset-session-button", "#reset-board-button",
            "#puzzle-board", "#equation-display", "#running-sum-toggle",
            "#scoreboard", "#timer-toggle", "#timer-duration"
        ];
        const missing = selectors.filter(selector => !appDocument.querySelector(selector));
        record("All required production controls exist", missing.length === 0, missing.join(", "));
        const optionValues = [...element("#operation").options].map(option => option.value);
        const engineReady = Object.keys(operations).every(operation =>
            optionValues.includes(operation) && engine.OPERATIONS[operation] === operation
        );
        record("Selector and engine expose all four operations", engineReady, optionValues.join(", "));
    }

    async function auditMatrix() {
        for (const [operation, [theme, symbol, runningLabel]] of Object.entries(operations)) {
            await change("#operation", operation);
            for (const [mode, modeClass] of Object.entries(modes)) {
                await change("#game-mode", mode);
                for (const [gridSize, terms] of configs) {
                    const label = `${operation} ${mode} ${gridSize}×${gridSize} / ${terms}`;
                    progress.textContent = `Testing ${label}…`;
                    await change("#grid-size", gridSize);
                    await change("#required-addends", terms);
                    await check("#timer-toggle", false);
                    await click("#new-puzzle-button", 30);

                    const boardCells = cells();
                    const values = boardCells.map(cell => cell.textContent.trim());
                    const equation = element("#equation-display").textContent;
                    const failures = [];
                    if (!appDocument.body.classList.contains(theme)) failures.push("theme");
                    if (!appDocument.body.classList.contains(modeClass)) failures.push("mode");
                    if (element("#running-sum-label").textContent.trim() !== runningLabel) failures.push("running label");
                    if (boardCells.length !== gridSize * gridSize) failures.push("cell count");
                    if (values.some(value => !value) || new Set(values).size !== values.length) failures.push("values");
                    if (status() !== "ROUND OPEN") failures.push(`status ${status()}`);
                    if (!equation.includes(symbol)) failures.push("symbol");

                    await click("#reveal-button");
                    const revealed = element("#equation-display").textContent;
                    const selected = appDocument.querySelectorAll("#puzzle-board .puzzle-cell.selected").length;
                    const matched = appDocument.querySelectorAll("#puzzle-board .puzzle-cell.correct").length;
                    if (status() !== "ANSWER REVEALED") failures.push("reveal status");
                    if (!revealed.includes(symbol) || !revealed.includes("=")) failures.push("reveal equation");
                    if (selected !== terms || matched !== 1) failures.push("reveal highlights");

                    await click("#reset-board-button");
                    if (status() !== "WAITING FOR PUZZLE") failures.push("reset board");
                    record(label, failures.length === 0, failures.join(", "));
                }
            }
        }
    }

    async function auditAttempts() {
        for (const operation of Object.keys(operations)) {
            await change("#operation", operation);
            await change("#game-mode", "CLASSIC");
            await change("#grid-size", 3);
            await change("#required-addends", 2);
            await check("#timer-toggle", false);
            await click("#reset-session-button");
            await click("#new-puzzle-button", 30);

            let values = numbers();
            const valid = engine.findCombinations(operation, values, 2, [])[0];
            const startScore = score();
            if (valid) {
                for (const index of valid.termIndexes) {
                    cells()[index].click();
                    await wait(10);
                }
            }
            record(
                `${operation}: correct attempt, equation, and score`,
                Boolean(valid) && status() === "STRIKE" &&
                    score() === startScore + 1 &&
                    element("#equation-display").textContent.includes("="),
                valid?.equation || "No valid combination"
            );

            await click("#reset-board-button");
            await click("#new-puzzle-button", 30);
            values = numbers();
            const invalid = invalidSelection(operation, values, 2);
            const startAttempts = attempts();
            if (invalid) {
                for (const index of invalid) {
                    cells()[index].click();
                    await wait(10);
                }
            }
            record(
                `${operation}: MISS, attempted equation, and attempts`,
                Boolean(invalid) && status() === "MISS" &&
                    attempts() === startAttempts + 1 &&
                    element("#equation-display").textContent.includes("="),
                invalid ? invalid.join(",") : "No invalid selection"
            );
            await click("#reset-board-button");
        }
    }

    async function auditSharedControls() {
        await change("#operation", "ADDITION");
        await change("#game-mode", "CLASSIC");
        await change("#player-count", 3);
        await click("#reset-session-button");
        await click("#next-player-button");
        const nextWorked = element("#active-player-name").textContent.trim() === "Player 2";
        await click("#previous-player-button");
        const previousWorked = element("#active-player-name").textContent.trim() === "Player 1";
        const nameInput = element("#scoreboard .player-row:first-child .player-name-input");
        nameInput.value = "Agent Echo";
        nameInput.dispatchEvent(new appWindow.Event("change", { bubbles: true }));
        await wait(20);
        const nameWorked = element("#active-player-name").textContent.trim() === "Agent Echo";
        record("Player count, next/previous, and editable names", nextWorked && previousWorked && nameWorked);

        await change("#game-mode", "PRACTICE");
        record(
            "Practice restrictions and no-timer state",
            element("#player-count").disabled &&
                element("#previous-player-button").disabled &&
                element("#next-player-button").disabled &&
                element("#timer-toggle").disabled &&
                element("#timer-duration").disabled &&
                element("#timer-caption").textContent.trim() === "NO TIMER"
        );
        await change("#game-mode", "CLASSIC");

        progress.textContent = "Testing five-second timer expiration…";
        await change("#grid-size", 2);
        await change("#required-addends", 2);
        await change("#timer-duration", 5);
        await check("#timer-toggle", true);
        await click("#new-puzzle-button", 30);
        const started = element("#timer-caption").textContent.trim() === "TIME REMAINING";
        await wait(5400);
        const expired = status() === "TIME UP" &&
            element("#timer-caption").textContent.trim() === "TIME EXPIRED";
        record("Timer starts and expires correctly", started && expired, `${status()} / ${element("#timer-caption").textContent.trim()}`);
        await click("#reset-board-button");
        await check("#timer-toggle", false);

        record("No unexpected Demo alerts", appWindow.__auditAlerts.length === 0, appWindow.__auditAlerts.join(" | "));
    }

    async function runAudit() {
        runButton.disabled = true;
        results = [];
        list.replaceChildren();
        summary.className = "summary running";
        summary.textContent = "Running production certification…";
        try {
            await reloadDemo();
            auditStructure();
            await auditMatrix();
            await auditAttempts();
            await auditSharedControls();
            const passed = results.filter(result => result.passed).length;
            const failed = results.length - passed;
            summary.className = failed === 0 ? "summary pass" : "summary fail";
            summary.textContent = failed === 0
                ? `PASS — ${passed}/${results.length} automated browser checks passed.`
                : `FAIL — ${failed} of ${results.length} automated browser checks failed.`;
            progress.textContent = failed === 0
                ? "Automated checks complete. Finish the human certification checklist."
                : "Review the failed checks before release.";
        } catch (error) {
            summary.className = "summary fail";
            summary.textContent = `AUDIT ERROR — ${error.message}`;
            record("Audit runner completed", false, error.stack || error.message);
        } finally {
            runButton.disabled = false;
        }
    }

    runButton.addEventListener("click", runAudit);
})();
