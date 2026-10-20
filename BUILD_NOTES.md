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

## Top-3 fixes port + seamless settings (third pass, 2026-10-20)

The top-3 fixes from the original test report (which lived only in
the separate `fixed-v1.1/` copy) were ported surgically onto this
build, hunk by hunk per `~/workspace/operation-hunt/PORT_PLAN_multi-op_fixes.md`
— no files were copied wholesale, so all multi-op work (operation
dropdown, negatives toggle, shared-state wiring, strict click
order) is intact. The same pass adds Clarence's seamless-settings
request. **Local only — NOT pushed to GitHub in this pass** (the
pushed `multi-op` branch is still commit
bd020144ffa51ff0f579943e5410521199d97305; the local files now
differ from it).

### 1. Real Reset Scores replaces Reset Session (demo + teacher)

- `demo.html` / `teacher.html`: the red button is now **Reset
  Scores** (`id="reset-scores-button"`).
- `resetScores()` in `js/demo.js` and `js/teacher.js` follows the
  fixed-v1.1 spec exactly: confirm ("Reset all player scores to
  zero? Player names and the current board will be kept."), then
  zero score/attempts/correct/currentStreak/bestStreak **in place**.
  Names, the current board, the active player and the Session
  Intel totals are kept.
- Teacher side: the zeroing happens on the shared players array
  and is persisted with `saveState("teacher-reset-scores")`, so it
  propagates to the Smart Board like any other player mutation
  (live-verified, below).

### 2. Double turn-advance removed (demo + teacher)

- The `advanceTurn` option and all its call sites are gone from
  `generatePuzzle()` in `js/demo.js` and `js/teacher.js`. Turns
  move only via Previous/Next Player and the auto-advance after a
  miss.

### 3. Inactive player rows hidden (all three screens)

- Demo `renderScoreboard()`, teacher `renderPerformanceTable()`
  and smartboard `renderScoreboard()` now iterate
  `players.slice(0, playerCount)` — Agents = 2 renders exactly 2
  rows. The player records themselves are untouched.

### 4. Seamless Operation / Allow Negatives changes (new)

Changing the Operation dropdown or the Allow Negatives toggle no
longer asks for confirmation and never wipes the board:

- The decision lives in the engine as
  `evaluateBoardForSettings(numbers, { operation, allowNegatives,
  requiredAddends })` (`js/puzzle-engine.js`, exported, unit-tested
  in Section H): the board is **playable** under the new settings
  iff (a) every tile is legal (whole numbers; no negative tiles
  while negatives are off, same −20 floor as generation while on)
  AND (b) `findCombinations` finds at least one valid combination
  on those exact tiles for the (possibly new) operation — the
  engine's strict click-order rules apply.
- **Playable → keep.** The exact same board stays; only the
  current selection/feedback is cleared, the solution set
  (`validCombinations`, `validTriples`, plus teacher's
  `correctAddends`/`sum`/`remainingTripleCount`) is recomputed,
  instructions/equation wording follows the new operation, and
  status returns to OPEN. Scores, names, active player and the
  timer are untouched.
- **Not playable → redeal in place.** A fresh puzzle is dealt
  immediately via `generatePuzzle({ preserveTimer: true })` — no
  turn advance, timer untouched, and the board passes straight
  from the old tiles to the new tiles with status OPEN. There is
  no page reload and no blank WAITING frame anywhere in the
  change path (there is no `location.reload` / navigation call
  anywhere in the codebase). As a cosmetic touch, the re-dealt
  tiles fade/settle in over 350 ms (`board-swap` class +
  keyframes in `css/demo.css` / `css/smartboard.css`; the
  smartboard flags it whenever a different board lands while a
  round is open, the demo only on a settings-change redeal).
- If the round had already ended (status TIME_UP) there is no
  live board to preserve, so the change clears back to WAITING,
  the same as Reset Board. With no puzzle at all, only the
  setting changes.
- Shared state: `js/shared-state.js` gained `setOperationInPlace()`
  / `setAllowNegativesInPlace()` — they update the setting (and
  re-clamp the minimum to the negatives floor) and save +
  broadcast **without** resetting puzzle/timer/Max Out state.
  The older `setOperation` / `setAllowNegatives` keep their
  reset behaviour and are unchanged. Teacher handlers apply the
  setting locally, run the board decision, and only then persist
  through the in-place setter, so the only save a settings change
  produces carries the final state (an intermediate save carrying
  the new operation with the old board could be echoed back by
  the Smart Board's sync and overwrite the final state — see the
  known limit below).
- Grid-size / Terms / Min / Max change behaviour is unchanged.

### Tests (third pass)

- New suite `tests/test-port-fixes.js` (**Section H, 78 checks,
  0 failures**): H1 source-level wiring (no `resetSession` /
  `advanceTurn` / `reset-session` anywhere in active files,
  Reset Scores buttons + handlers, all three renderers slice by
  playerCount, no confirm-and-clear strings for operation /
  negatives); H2 the keep-vs-redeal decision against the real
  engine (keep: [4,13,20,9] addition→subtraction via 13 − 4 = 9,
  [12,3,4,7] division via 12 ÷ 3 = 4, negatives board
  [−2,8,−8,−6] with negatives on via −8 − −2 = −6, negatives
  switched ON keeping an all-positive board; redeal:
  [4,13,20,9]→division/multiplication, [2,3,5,8]→multiplication,
  negative tiles with negatives switched OFF → `illegal-tiles`,
  a 0 tile with negatives off, 3-term cases, empty board);
  H3 shared-state seams (in-place setters do NOT clear a board,
  minimum clamp works through them, legacy `setOperation` still
  resets, and an in-place-zeroed players array reaches a freshly
  loaded second screen with names/board/active player/totals
  intact and `slice(0, playerCount)` yielding exactly 2 rows).
- Regression: `tests/test-teacher-smartboard.js` — 47 checks,
  0 failures (its G6 gate re-runs the engine suite);
  `tests/test-multi-op.js` — 0 failures (916k–925k checks
  depending on the run; the count varies because it includes
  per-combination assertions on randomly generated boards).
- `node --check` passes on all JS files.

### Live verification (third pass, headless Chrome via CDP, file:// pages, fresh profile per run)

Demo (single page):
- Dealt 5,7,6,1 and struck 5 + 1 = 6 (Player 1 → 1 point).
- New board 18,3,15,10; toggled Allow Negatives ON mid-game →
  same board, ROUND OPEN, score/active player preserved, no
  dialog.
- Injected board 12,3,4,7 under Addition, switched Operation to
  Division → board kept exactly, status ROUND OPEN, solutions
  recomputed (12 ÷ 3 = 4; 12 ÷ 4 = 3), instructions rewritten to
  "divide to make", score preserved. (Screenshot:
  `screenshots/port-seamless-op-change.png`.)
- Injected 2,3,5,8 under Addition, switched to Multiplication →
  fresh board 2,7,16,14 dealt instantly (2 × 7 = 14), status
  OPEN — never WAITING.
- Negatives board −2,8,−8,−6 under Subtraction, toggled Allow
  Negatives OFF → fresh all-positive board 8,7,3,4 dealt in
  place, minimum re-clamped to 1.
- Reset Scores: scores/attempts zeroed, names/board/totals kept.
  Next Player → New Puzzle leaves the active player at 1 (no
  skip). Scoreboard renders 4 rows at Agents = 4 and 2 at
  Agents = 2. The ONLY dialog in the whole scenario was the
  Reset Scores confirm — operation/negatives changes raise none.

Teacher + Smart Board (two targets, one browser):
- Teacher dealt 5,8,3,10 (5 + 3 = 8); board synced; student
  struck on the board; score/attempts synced back to the
  teacher; Next Player → New Puzzle kept the active player at
  Player 2 on both screens.
- Teacher Reset Scores → Smart Board scoreboard showed both
  players at 0 with exactly 2 rows, board 10,9,19,11 kept,
  Player 2 still active, Session totals (Puzzles 2, Attempts 1,
  Correct 1) preserved. (Screenshot:
  `screenshots/port-reset-scores-board.png`.)
- Teacher switched Addition → Division with board 12,3,4,7 in
  play → board kept the same tiles, showed Division
  instructions, no swap animation (nothing was re-dealt).
  (Screenshot: `screenshots/port-seamless-op-change-board.png`.)
- Teacher switched Addition → Multiplication with board
  2,3,5,8 in play → new board 5,10,8,2 (5 × 2 = 10) dealt in
  place on both screens, status OPEN, and the board's
  `board-swap` fade class was observed live.

### Known limits (third pass)

- **Pre-existing sync echo race (not introduced here):**
  shared-state sync has no versioning — a receiving screen
  writes localStorage inside `replaceState()`, and the other
  screen applies `storage` events unconditionally. Two saves
  fired microseconds apart (holding Next Player + New Puzzle in
  one scripted burst, then a third action immediately) can
  interleave so an earlier state is re-applied and the newest
  action is lost; this reproduced under scripted CDP pacing
  (<100 ms between actions) and did NOT reproduce with
  human-like pacing (≥1 s between actions, all checks above).
  A revision counter on saves would close it; left as a
  follow-up decision rather than folded into this port.
- Changing the operation during the ~900 ms strike-feedback
  window keeps/redeals the board but leaves the (already
  stopped) timer stopped for the rest of that round — the
  timer is deliberately untouched by settings changes.
- In flow modes (Max Out / Practice), a settings change made
  in the same feedback window clears the just-struck combo
  from the kept board's solution set recomputation, so that
  combo could be struck again on the kept board. Cosmetic
  rules edge, only reachable mid-animation.
