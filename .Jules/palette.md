## 2024-10-24 - aria-pressed on button groups
**Learning:** For generic button groups used as tabs or filters without full ARIA tab structural markup, screen readers miss the active state. This is a common pattern in the app.
**Action:** Always use aria-pressed={isActive} on generic buttons to accurately communicate the active/pressed state.
