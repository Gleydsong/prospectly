## 2024-05-24 - Accessibility on Button Tabs/Toggles
**Learning:** Generic buttons used to mimic tabs, toggle groups, or filter selections in this app frequently lack proper ARIA structural markup indicating their active state (`aria-pressed`).
**Action:** When working on generic buttons imitating stateful toggle behavior, add the `aria-pressed={isActive}` attribute.
