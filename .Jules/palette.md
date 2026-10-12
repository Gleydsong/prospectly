
## 2024-05-18 - [Button Accessibility for Tabs and Filters]
**Learning:** Generic buttons used to mimic tabs or filter selections without complete `role="tablist"` and `role="tab"` structural markup don't communicate their active/pressed state to screen readers by default, which can cause accessibility issues for users relying on assistive technologies.
**Action:** Always add the `aria-pressed={isActive}` attribute to these toggle buttons to accurately communicate their state, following the established app guidelines.
