## 2024-10-20 - Active State Communication on Toggle Buttons
**Learning:** Custom UI components acting as toggle groups or tabs often use visual cues (like background colors or bold text) to indicate the active state but omit semantic attributes, leaving screen reader users unaware of which option is currently selected.
**Action:** When implementing generic buttons as tabs or toggle selections, always add `aria-pressed={isActive}` to explicitly convey the state to assistive technologies.
