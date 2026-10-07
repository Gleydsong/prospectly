## 2026-10-07 - Accessible Toggle Buttons
**Learning:** When using generic buttons to mimic tabs, toggle groups, or filter selections without complete `role="tablist"` and `role="tab"` structures, using `aria-pressed` is a robust and simple way to communicate the active/pressed state of these controls to assistive technologies.
**Action:** Always add `aria-pressed={isActive}` to toggle buttons and filter buttons that maintain an active visual state.
