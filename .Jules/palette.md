## 2024-10-24 - [Fix ARIA attributes merging]
**Learning:** When building reusable UI components, explicitly merge custom ARIA attributes (like `aria-describedby` for error states) with any attributes provided via props to prevent losing user-defined values.
**Action:** Always extract, combine, and apply ARIA attributes *after* spreading `{...props}` in form controls.
