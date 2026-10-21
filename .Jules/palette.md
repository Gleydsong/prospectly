## 2025-01-28 - Provide Visual Focus Indicator on Buttons
**Learning:** The Button component removed the default focus outline using `focus-visible:outline-none` without adding an alternative focus ring, which severely impacts keyboard navigation accessibility.
**Action:** When styling interactive elements like Buttons with Tailwind CSS, never remove the default outline without explicitly providing an alternative visual focus indicator (e.g., `focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]`) to ensure keyboard navigation accessibility is maintained.
