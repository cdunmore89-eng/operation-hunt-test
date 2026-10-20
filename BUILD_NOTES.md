# Operation Hunt — Multi-Operation Build Notes

Working copy built 2026-10-20 in `~/workspace/operation-hunt/multi-op/`.
Originals (`~/workspace/operation-hunt/original/`) unmodified; nothing
committed or pushed to GitHub. (An earlier revision of these notes said
the Teacher and Smart Board pages were still addition-only; that is
superseded by the "Teacher + Smart Board wiring" section at the end —
all three screens now play all four operations.)

## What changed, per file

### `js/puzzle-engine.js` (16,597 → 37,870 bytes)

- **Operations metadata**: exported `OPERATIONS` (addition `+`,
  subtraction `−`, multiplication `×`, division `÷`, with a
  `commutative` flag), `normalizeOperation()`, `getOperation()`, and
  `computeResult(values, operation)` — a left fold that returns `null`
  when a division step does not divide exactly.
- **`findCombinations(numbers, requiredTerms, excludedIndexes, operation)`**:
  the generalized combo finder. Addition/multiplication check unordered
  operand sets; subtraction/division check every operand *permutation*
  (left fold), so both orders exist as separate combos when both are
  arithmetically true on the board. Combo records keep all original
  fields (`addendIndexes`, `addendValues`, `equation`, …) and add
  `operandIndexes`, `operandValues`, `operation`, `symbol`. The
  equation string uses the operation's symbol, e.g. `12 ÷ 3 = 4`.
- **`findComboForOperation(numbers, selectedIndexes, requiredTerms,
  excludedIndexes, operation)`** — see the click-order rule below.
- **`createNumberPuzzle` accepts `options.operation`** (default
  `"addition"`) **and `options.allowNegatives`** (default `false`).
  Generation per operation builds a base combo (operands + result, all
  values distinct and in range), fills the rest of the board with
  unused range values, shuffles, and verifies with `findCombinations`
  for the active operation, exactly like the original:
  - Addition: original logic (plus a result ≥ minimum check, needed
    once negative minimums exist).
  - Subtraction: ordered operands; largest-first when negatives are
    off so the result stays non-negative, sampled order kept when
    negatives are on so results may be negative.
  - Multiplication: distinct operands whose product is in range and
    different from both operands.
  - Division: divisor(s) and quotient of magnitude ≥ 2 (a factor of
    ±1 would make the dividend equal another tile value), dividend =
    divisor × quotient in range, all three values distinct.
  - Deterministic fallback constructions per operation if random
    sampling fails, then the original retry/throw behaviour.
- **`getMinimumMaximumForOperation(minimum, boardSize, requiredTerms,
  operation)`** — operation-aware minimum maximum. The original
  `getMinimumMaximumForPuzzle` now delegates to it with addition, so
  existing callers (including the untouched Teacher page) behave
  identically. Formulas use the smallest feasible construction, e.g.
  division needs the product of the smallest distinct factors
  (2 terms from 1: max ≥ 6; 3 terms: max ≥ 24); multiplication from 1
  needs 6 for 2 terms; subtraction needs the smallest starting number
  (2 terms from 1: 3).
- **Backward compatibility**: `findAdditionCombinations`,
  `findAdditionTriples`, `findComboForSelection`,
  `findTripleForSelection`, `hasRemainingTriples`,
  `createFourNumberPuzzle`, `getMinimumMaximumForPuzzle`, etc. all
  still exist and behave as before for addition.

### `js/demo.js` (43,612 → 50,809 bytes)

- `state.settings.operation` (default `"addition"`) and
  `state.settings.allowNegatives` (default `false`); both wired
  through `elements`, `renderSettings()`, and change handlers modelled
  on `updateGameMode()`: if a puzzle exists the teacher is asked to
  confirm ("Changing the operation / Allow Negatives will clear the
  current puzzle. Continue?"), the select/toggle reverts if declined,
  otherwise feedback/timer are cleared, the puzzle state resets, the
  number range is re-enforced (the maximum can rise for
  multiplication/division; the minimum re-clamps to the negatives
  floor), and the screen re-renders.
- `generatePuzzle()` passes `operation` and `allowNegatives` into
  `createNumberPuzzle`; `getRequiredMaximumForSettings()` is
  operation-aware.
- Answer checking (`checkClassicAnswer`, `checkFlowAnswer`) and
  Reveal (flow branch) use the operation-aware finders; Classic
  Reveal uses `state.validCombinations`, which the generator now
  fills with combos for the active operation.
- The equation line joins the selected values with the current
  operation's symbol, and the running result left-folds the selected
  values **in click order**; an inexact division fold shows `?`
  instead of a fraction. On a strike/reveal the displayed equation is
  the combo record's equation (which itself follows click order).
- Instruction text is operation-aware in all three game modes, e.g.
  Classic: "Find 2 numbers that add to / subtract to make /
  multiply to make / divide to make another number on the radar and
  strike the target." The mode chip in the radar header now also
  names the operation (e.g. "Classic Hunt Training Active ·
  Division").
- The Min input's floor is gated on the negatives switch: 1 when off,
  −20 when on (`enforceNumberRangeForGrid`, `readNumberSettings`,
  and the input's `min` attribute all use the same floor).

### `demo.html` (9,779 → 10,449 bytes)

- **Operation** `<select id="operation">` in Mission Setup, directly
  under the Game Mode select: Addition / Subtraction /
  Multiplication / Division.
- **Allow Negatives** toggle (`#allow-negatives-toggle`) under the
  Operation select, reusing the existing timer-switch styling
  (`timer-switch` / `switch-track` / `switch-knob` classes).
- The static header instruction is unchanged in the HTML;
  `renderGameMode()` overwrites `#game-instructions` on every render,
  so the live text is always operation-aware.
- The running-sum toggle still says "Show Running Sum" — for the
  other operations it shows the running *result* of the fold. Label
  left as-is deliberately.

## The click-order rule (Clarence's decision)

Click order **is** the equation order. For subtraction and division a
selection matches only when a combo's ordered operand indexes equal
`state.selectedIndexes` in the exact order clicked:

- Board [12, 3, 9, 5], click 12 then 3 → strike, `12 − 3 = 9`.
- Click 3 then 12 → **miss** (with negatives off). It only scores if
  −9 is itself a tile on the board and negatives are on, in which
  case the equation is `3 − 12 = -9`.
- Board [12, 3, 4, 7], click 3 then 12 → miss (`3 ÷ 12` is not a
  whole number); click 12 then 3 → strike, `12 ÷ 3 = 4`.

For addition and multiplication any click order of the right operands
scores (the result is the same), but the returned/displayed equation
is rebuilt in click order (`3 + 2 = 5` when 3 was clicked first).

## Allow Negatives switch

- **Default OFF.** Off = original behaviour: minimum ≥ 1, all tile
  values ≥ 1, subtraction results non-negative, no negatives anywhere.
- **ON**: the Min input may go down to **−20** (hard floor; the
  engine rejects a minimum below −20, and rejects any negative
  minimum while the switch is off). Tile values are unique integers
  in [minimum, maximum], including negatives and zero. Sign rules are
  the normal integer rules for all four operations; division must
  still divide exactly; a divisor is never 0. Subtraction results may
  be negative and score when the result tile is on the board.
- Proof it does something (test suite D): at min −10, max 20, of
  2,000 generated subtraction puzzles, **1,426** had a solution using
  a negative operand or a negative result, and **1,624** contained at
  least one negative tile.

## Test results

`~/workspace/operation-hunt/test-multi-op.js` (node, engine-level;
**922,508 checks, 0 failures**, ~8 s):

- **A** — 5,000 puzzles per operation at the defaults (min 1, max 20,
  2×2, 2 terms): every puzzle has ≥ 1 valid combo for its operation,
  all values unique and in range, every combo equation
  arithmetically correct.
- **B** — click-order assertions above, all pass, including the
  negative-tile reversed subtraction.
- **C** — legacy addition API unchanged (`2 + 3 = 5` on [2,3,5,8],
  `createFourNumberPuzzle`, minimum-maximum delegation).
- **D** — negatives on: 2,000 puzzles per operation at min −10,
  max 20 and 500 per operation at min −5, max 10, all verified
  (solvable, unique, in range, equations correct including sign);
  floor −20 and switch-off rejection verified.
- **E** — bigger boards, 2 terms, 500 puzzles per operation per
  size: 3×3 and 4×4 at min 1, max 20; **5×5 at max 30**. A 5×5 board
  needs 25 unique tiles, which cannot come from the 20 values in
  [1,20] — the engine rejects that combination with a clear error
  (asserted in the tests), and the demo raises the maximum
  automatically when a bigger grid is chosen, the same way the
  original game already did. At a feasible maximum every operation
  generates verified-solvable 5×5 boards.
- **F** — multi-term: addition 3 terms (3×3, max 20) and 4 terms
  (4×4, max 30), 300 each; subtraction and division 3 terms (4×4,
  max 60), 300 each — all generated and verified. Multi-term
  subtraction/division use the same left fold in click order;
  feasibility needs a bigger maximum (e.g. 3-term division from 1
  needs max ≥ 24, because the smallest dividend is 2×3×4), which the
  demo enforces automatically via the operation-aware
  minimum-maximum. 4-term division needs max ≥ 120 from 1 for the
  same reason.

Syntax: `node --check` passes on both modified JS files.

## Known limits

- ~~Teacher / Smart Board pages are not wired for operations yet.~~
  Done — see the next section.
- Grid sizes and Terms behave per the original game's constraints:
  2×2 is always 2 terms; 3×3 allows 2–3; 4×4/5×5 allow 2–4. Those
  rules were not changed.
- No browser testing was done for this build — engine tests and
  syntax checks only. The visual check (screenshots per operation)
  is the parent agent's step.

## Teacher + Smart Board wiring (second pass, 2026-10-20)

The Operation setting and the Allow Negatives switch now live in the
shared state, so the Teacher screen controls them and the Smart Board
screen plays them. The Demo screen was not changed in this pass.

### `js/shared-state.js` (13,822 → 16,316 bytes)

- `settings.operation` (default `"addition"`) and
  `settings.allowNegatives` (default `false`) added to the defaults.
  A hardcoded operation id list (`addition`, `subtraction`,
  `multiplication`, `division`) + a local `normalizeOperation()`
  mirror the engine's, so normalization stays consistent wherever
  state is loaded.
- `normalizeState()` now preserves both fields from saved state and
  clamps `minimumNumber` conditionally:
  `allowNegatives ? Math.max(-20, min) : Math.max(1, min)`. Legacy
  saved states without the new fields load as addition / negatives
  off — zero visible change for existing sessions.
- `normalizeCombination()` additionally preserves a combo's
  `operandIndexes`, `operandValues`, `operation` and `symbol` when
  present, so an ordered subtraction/division combo generated on the
  teacher screen keeps its operand order when it crosses to the
  smart board.
- New API on `window.OperationHuntState`: `setOperation()` and
  `setAllowNegatives()` — each updates the setting, resets the
  shared puzzle/timer/Max Out state, saves and broadcasts
  (`setAllowNegatives` also re-clamps the minimum to the new floor).
  Also exported: `OPERATIONS`, `DEFAULT_OPERATION`,
  `MINIMUM_FLOOR_WITH_NEGATIVES` (-20),
  `MINIMUM_FLOOR_WITHOUT_NEGATIVES` (1), `normalizeOperation`.
- Propagation (unchanged mechanism, verified): there is no
  field-level sync — every mutation saves the *whole*
  `sharedState` object to localStorage and posts it on the
  BroadcastChannel (`STATE_UPDATED`), and the receiving side runs it
  through `normalizeState()` via `replaceState()`. The two new
  fields ride along automatically, and normalization guarantees a
  screen can never end up with an invalid operation or an
  out-of-floor minimum from a broadcast.

### `teacher.html` (9,191 → 9,971 bytes)

- **Operation** `<select id="operation">` in Game Settings, directly
  under Game Mode: Addition / Subtraction / Multiplication /
  Division.
- **Allow Negatives** toggle (`#allow-negatives-toggle`), a
  `timer-switch`-styled switch (the same classes as the Round Timer
  switch) directly under the Operation select.

### `js/teacher.js` (22,226 → 27,349 bytes)

- Operation helpers mirror demo.js (`getOperation`,
  `getOperationMeta/Symbol/Label`, `getMinimumFloor`), and
  `getRequiredMaximumForSettings()` now calls the engine's
  `getMinimumMaximumForOperation(..., operation)` (the legacy
  `getMinimumMaximumForPuzzle` remains as fallback).
- `readNumberSettings()` validates the minimum against the toggle's
  floor (-20 on / 1 off) instead of a hard-coded 1, and keeps the
  minimum input's `min` attribute in sync.
- `generatePuzzle()` passes `operation` + `allowNegatives` into
  `createNumberPuzzle`; the dashboard's "Correct Equation" therefore
  shows the operation's equation from the combo record, as before.
- `revealAnswer()` uses `findCombinations(puzzle, terms, [],
  operation)` instead of `findAdditionCombinations` (addition falls
  back if an old engine is ever paired with this file).
- `updateOperation()` / `updateAllowNegatives()` follow the same
  structural-setting pattern as grid/terms: if a puzzle exists the
  teacher confirms ("Changing the operation / Allow Negatives will
  clear the current puzzle. Continue?"), declining reverts the
  control; accepting routes through the shared-state setters (which
  reset + broadcast the shared state), re-runs the number-settings
  sync (minimum re-clamp, operation-aware required maximum), saves
  and re-renders.
- `renderSettings()` syncs the new controls from shared state (so a
  smart-board-driven broadcast or a reload shows the right values)
  and sets the minimum input's floor attribute; the teacher header
  mode label now reads e.g. "Classic Mission · Multiplication".

### `js/smartboard.js` (21,098 → 23,223 bytes) — `smartboard.html` unchanged

- Operation helpers mirror demo.js, including the verb phrases.
- Answer checking uses `findComboForOperation(puzzle, selected,
  terms, [], operation)` — strict click order for
  subtraction/division, exactly like the demo.
- Its flow-mode generator (`generateFlowPuzzle`) passes `operation`
  + `allowNegatives` into `createNumberPuzzle`, so Max Out /
  Practice next-puzzles stay in the teacher's operation.
- The equation line joins selected values with the operation symbol
  and the running result left-folds in click order via the engine's
  `computeResult` ("?" for an inexact division fold).
- Instructions name the operation ("Find 2 numbers that subtract to
  make / multiply to make / divide to make another number" in
  Classic; Max Out / Practice texts were already operation-neutral)
  and the mode label appends the operation ("2×2 Classic ·
  Division"). Revealed/strike rendering reads combo records whose
  ordered operand fields now survive shared-state normalization.
- No new controls on the board — it plays whatever the teacher set,
  arriving through the shared state it already subscribes to.

### Tests (second pass)

New suite `~/workspace/operation-hunt/test-teacher-smartboard.js`:

- **G1–G4** load the real `shared-state.js` standalone in node
  (localStorage / BroadcastChannel / CustomEvent stubbed — those are
  the only browser APIs it touches) and exercise its exported API:
  defaults; `setOperation` / `setAllowNegatives`; a
  save → localStorage → fresh-load round-trip proving operation,
  allowNegatives and minimumNumber -10 all survive to a "second
  screen"; minimum clamping both ways (-99 → -20 with negatives on,
  -5 → 1 with negatives off, turning the switch off re-clamps -10 →
  1, legacy states default cleanly); and combo-record preservation
  of the operand/operation fields. **47 checks, 0 failures.**
- **G5** is source-level wiring verification for teacher.js /
  smartboard.js / the HTML files (control ids present, the exact
  operation-aware engine calls used, no controls added to the smart
  board) — the two controllers are DOM code and cannot be loaded in
  node; their live behaviour is the parent agent's browser check.
- **G6** re-runs the full previous suite (`test-multi-op.js`) as a
  regression gate: **924,518 checks, 0 failures** in this run (the
  count varies slightly between runs because it includes
  per-combination assertions on randomly generated boards).
- `node --check` passes on `shared-state.js`, `teacher.js`,
  `smartboard.js` (and the unchanged `demo.js` / `puzzle-engine.js`).

### Limits (second pass)

- Structural changes on the teacher screen reset Max Out round
  state as well as the puzzle (via the shared setters) — consistent
  with changing Game Mode, which already did that.
- Teacher/smartboard live interaction (two tabs, one browser
  profile) was not browser-tested here — node tests + syntax checks
  only, per the build split; the parent agent verifies live.
