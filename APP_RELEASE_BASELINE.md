# Operation Hunt — Certified Web Release Baseline

## Approval

The complete four-operation web game is approved as the source baseline for native iOS and Android packaging.

Certification date: **July 26, 2026**

```text
Repository: cdunmore89-eng/operation-hunt-test
Branch: app-release
Certified snapshot: c3d97026ae523f86496c5ee35d4946336e73dcae
```

## Certified results

```text
Arithmetic engine regression: 270/270 PASS
Production browser audit:     122/122 PASS
Human certification:          PASS
Release-blocking issues:       NONE REPORTED
```

## Included product scope

- Addition, subtraction, multiplication, and division
- Classic Mission, Max Out Challenge, and Practice Mode
- 2×2, 3×3, 4×4, and 5×5 boards
- Two-, three-, and four-term equations
- Running Sum, Difference, Product, and Quotient
- Exact whole-number division and divide-by-zero protection
- Reveal, STRIKE, MISS, timers, scoring, turns, accuracy, and resets
- Persistent multi-solution boards with used-tile exclusion
- Responsive desktop, tablet, and phone layouts
- Keyboard, zoom, accessibility, and physical touch approval

## Baseline protection

Native packaging may add platform projects, configuration, icons, splash screens, lifecycle handling, offline support, billing, ads, and store-compliance resources.

Any later change to the certified game engine, gameplay controller, or approved web interface must rerun:

1. `arithmetic-regression.html`
2. `production-audit.html`
3. Relevant human browser/device checks

## Phase status

```text
Phase 1 — Addition reference build:       COMPLETE
Phase 2 — Four-operation game engine:     COMPLETE
Phase 3 — Production certification:       COMPLETE
Phase 4 — Native application packaging:   NEXT
```
