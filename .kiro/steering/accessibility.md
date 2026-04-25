---
inclusion: auto
---

# Accessibility Requirements

## Keyboard Navigation

- All interactive elements (buttons, toggles, form inputs, links) MUST be reachable and operable via keyboard alone.
- Focus order MUST follow a logical reading sequence.
- Custom toggle switches MUST respond to Space and Enter keys.

## Screen Reader Support

- All form inputs MUST have associated `<label>` elements.
- Toggle switches MUST use `role="checkbox"` (or native checkbox) with `aria-checked`.
- Status indicators (risk badges, budget displays) MUST use `role="status"` with descriptive `aria-label`.
- Visual-only indicators (color-coded bars, progress segments) MUST have text alternatives via `aria-label` or visually hidden text.

## ARIA Labels

- Heat budget progress bars MUST have `aria-label` describing the current budget state (e.g., "Heat budget: 65% consumed, 35% remaining").
- Risk level badges MUST have `aria-label` including the risk level text.
- Transition cards MUST have `aria-label` summarizing origin, destination, and risk level.

## Color and Contrast

- Risk level colors (green/amber/red) MUST NOT be the sole means of conveying information — always pair with text labels.
- Maintain sufficient color contrast ratios for all text content.
