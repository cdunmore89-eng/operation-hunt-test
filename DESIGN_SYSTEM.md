# Operation Hunt Design System

This document is the visual and interaction standard for the Operation Hunt product family.

The approved `main` branch remains the Gold Master. New visual work is developed and tested on `app-release` before being moved into production screens.

## Product principles

1. **The board is the hero.** Controls support gameplay and must not compete with the puzzle board.
2. **Every action explains itself.** Selected terms, computed results, matched targets, misses, timer changes, and player changes must remain visible long enough to understand.
3. **Classroom clarity beats decoration.** The interface should be readable across a room and usable on a smart board, tablet, or phone.
4. **One product language.** Demo, Smart Board, Teacher Dashboard, mobile apps, and future Operation Hunt games should use the same tokens and component behavior.
5. **Touch first.** Interactive controls must be at least 44px tall and should not depend on hover.

## Shared stylesheet

Use:

```html
<link rel="stylesheet" href="css/operation-hunt-design-system.css">
```

The stylesheet contains namespaced `--oh-*` tokens and `.oh-*` component classes to avoid collisions with existing approved CSS.

## Color roles

| Role | Token | Value | Usage |
|---|---|---:|---|
| Mission identity | `--oh-navy-950` | `#071A33` | Header, major status, scoreboard header |
| Primary action | `--oh-blue-600` | `#2463EB` | New puzzle, focus, active state |
| Correct / success | `--oh-green-600` | `#138A4B` | Matched target, next action, success feedback |
| Selection / warning | `--oh-yellow-500` | `#E6A700` | Locked target, focus ring, timer warning |
| Error / miss | `--oh-red-600` | `#C93636` | Miss, expired timer, destructive action |
| Reveal | `--oh-purple-600` | `#7048D7` | Reveal action only |
| Previous / caution | `--oh-orange-600` | `#D96F19` | Previous player or secondary warning |
| Page background | `--oh-gray-100` | `#F1F5F9` | App canvas |
| Panel surface | `--oh-white` | `#FFFFFF` | Cards and controls |

Do not use success green for ordinary navigation, miss red for decoration, or target yellow for large background areas.

## Typography

- Display headings and large puzzle terms use `--oh-font-display`.
- Controls, labels, instructions, and body copy use `--oh-font-ui`.
- Uppercase with wide tracking is reserved for short labels and status text.
- Instructions should use sentence case.
- Avoid long paragraphs on gameplay screens.

## Spacing and shape

- Base spacing unit: 4px.
- Standard control gap: 12px.
- Standard panel padding: 20px.
- Minimum touch target: 44px.
- Standard button radius: 10px.
- Standard panel radius: 22px.
- Use one elevated shadow per major layer. Do not stack heavy shadows.

## Component rules

### Buttons

Base class: `.oh-button`

Variants:

- `.oh-button--primary`
- `.oh-button--success`
- `.oh-button--warning`
- `.oh-button--danger`
- `.oh-button--reveal`
- `.oh-button--neutral`

Buttons must provide visible hover, press, keyboard-focus, disabled, and touch behavior.

### Puzzle tiles

Base class: `.oh-tile`

States:

- `.oh-tile--selected` or `.oh-tile--locked`
- `.oh-tile--matched`
- `.oh-tile--miss`

A state should never be communicated by color alone. Production tiles should also use text, an icon, a border change, or an animation.

### Equation bar

Use `.oh-equation-bar` with:

- `.oh-equation-bar__label`
- `.oh-equation-bar__value`
- `.oh-equation-bar__assist`

The equation bar must show the selected terms and computed result after both correct and incorrect attempts.

### Feedback

Use `.oh-feedback` plus one state:

- `.oh-feedback--locked`
- `.oh-feedback--matched`
- `.oh-feedback--miss`

Recommended minimum display times:

- Target matched: 900ms
- Miss: 650ms
- Player change: 500ms

### Timer

Use `.oh-timer` with:

- `.oh-timer--warning`
- `.oh-timer--expired`

When time reaches zero, the text must change from `TIME REMAINING` to `TIME EXPIRED`; color alone is insufficient.

### Scoreboard

Use `.oh-score-row`, `.oh-score-row--header`, and `.oh-score-row--active`.

The active player should be indicated by row emphasis or a clear highlight. A dedicated `Turn` column is optional and should be omitted when row highlighting is sufficient.

## Motion standard

Motion must clarify an event rather than decorate the screen.

- Button press: 120ms
- Tile selection: 120–220ms
- Score bump: about 320ms
- Miss shake: about 280ms
- Result hold: controlled by gameplay timing

Reusable classes:

- `.oh-animate-pop`
- `.oh-animate-miss`
- `.oh-animate-score`

The shared stylesheet respects `prefers-reduced-motion`.

## Accessibility standard

- Minimum interactive size: 44px.
- Keyboard focus must be visible.
- Text and controls must maintain readable contrast.
- Do not rely on color alone.
- Include accessible labels for icon-only controls.
- The puzzle board must remain operable without precise mouse input.
- Mobile layouts must not require horizontal scrolling.

## Safe migration process

For each production component:

1. Reproduce the existing component in `design-lab.html`.
2. Apply the shared token or component class.
3. Compare the visual result at desktop, tablet, and phone widths.
4. Move only that component into the target production file.
5. Test gameplay and the browser console.
6. Commit the isolated change.

Do not replace an entire production stylesheet to adopt the design system.

## Release checklist for every visual change

- Existing gameplay still works.
- No new console errors.
- Keyboard focus is visible.
- Touch targets are at least 44px.
- 2×2, 3×3, 4×4, and 5×5 layouts remain usable.
- Target Locked, Target Matched, and Miss states remain clear.
- Mobile layout does not overflow horizontally.
- Reduced-motion users are supported.
