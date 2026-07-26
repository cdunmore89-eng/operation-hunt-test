# Operation Hunt — Phase 3 Production Audit

## Purpose

Phase 3 certifies the complete four-operation web game as one production build before native iOS and Android packaging begins.

This phase does not add new gameplay. It verifies that the approved systems work together without regressions and records the exact build that will become the mobile-app baseline.

## Current status

- Addition reference build: approved
- Subtraction: approved
- Multiplication: approved
- Division: approved
- Four-operation engine regression: approved
- Browser-level production certification: ready for execution
- Human responsive/device certification: pending
- Production baseline freeze: pending

## Automated engine regression

Open `arithmetic-regression.html`.

Expected result:

```text
PASS — 270/270 checks passed.
```

The engine regression verifies:

- all four operations
- every supported grid and term configuration
- board size and unique values
- valid generated combinations
- equation correctness
- selection lookup
- used-position exclusion
- subtraction starting-number order
- multiplication factor-order flexibility
- division dividend order
- division divisor-order flexibility
- exact division at every step
- divide-by-zero protection

## Automated browser certification

Open `production-audit.html` and select **Run Full Audit**.

Expected result:

```text
PASS — 122/122 automated browser checks passed.
```

The browser certification loads the real `demo.html` and verifies:

- all required production controls exist
- the selector and engine expose all four operations
- 4 operations × 3 modes × 9 grid/term configurations
- correct operation theme, symbol, and running-result label
- correct board dimensions and unique populated values
- ROUND OPEN state
- Reveal equation and tile highlighting
- Reset Board behavior
- correct-attempt STRIKE behavior
- score updates
- wrong-attempt MISS behavior
- attempt-count updates
- attempted equation persistence
- player count
- Previous and Next Player
- editable names
- Practice Mode restrictions
- timer start and expiration
- absence of unexpected alert messages

## Human certification checklist

The following checks remain intentionally human because they depend on visual judgment, hardware, or browser developer tools:

- no console errors during normal play
- desktop layout at approximately 1440px and 1024px
- tablet layout around 768px–900px
- phone layout around 390px
- keyboard focus visibility and order
- readability at 200% browser zoom
- timer, feedback, and animation quality
- physical touch testing on a phone or tablet

## Release matrix

Each operation must pass the following:

| Area | Addition | Subtraction | Multiplication | Division |
|---|---:|---:|---:|---:|
| Classic Mission | Approved | Approved | Approved | Approved |
| Max Out Challenge | Approved | Approved | Approved | Approved |
| Practice Mode | Approved | Approved | Approved | Approved |
| 2×2–5×5 grids | Approved | Approved | Approved | Approved |
| 2–4 terms | Approved | Approved | Approved | Approved |
| Running result | Approved | Approved | Approved | Approved |
| Reveal | Approved | Approved | Approved | Approved |
| STRIKE / MISS | Approved | Approved | Approved | Approved |
| Scoring / accuracy | Approved | Approved | Approved | Approved |
| Timer | Approved | Approved | Approved | Approved |
| Persistent flow boards | Approved | Approved | Approved | Approved |

## Phase 3 completion rule

Phase 3 is complete when:

1. `arithmetic-regression.html` passes all 270 checks.
2. `production-audit.html` passes all 122 browser checks.
3. Every human certification item is confirmed.
4. Any discovered issue is fixed and both automated suites are rerun.
5. The resulting `app-release` commit is recorded as the frozen web baseline.

After the baseline is frozen, development advances to Phase 4: native iOS and Android application packaging.
