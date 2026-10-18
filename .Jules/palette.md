## 2026-09-28 - Focus Visible Styles for Button Component
**Learning:** The Button component lacks visual feedback for keyboard focus, as it sets 'focus-visible:outline-none' but doesn't provide an alternative ring style, which violates accessibility guidelines for keyboard navigation.
**Action:** Add a focus ring (e.g. 'focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]') to the Button component.
