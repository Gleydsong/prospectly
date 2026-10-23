## 2024-03-24 - Form Error Accessibility
**Learning:** Using `useId()` generates IDs with colons (e.g., `:r0:`) which can break CSS selectors or cause issues. Furthermore, inline errors must be explicitly linked to inputs using `aria-describedby`, and these ARIA props must be applied *after* spreading `{...props}` to prevent overwriting.
**Action:** Always sanitize auto-generated IDs (`useId().replace(/:/g, '')`) and place `aria-*` props like `aria-describedby` and `aria-invalid` after `{...props}` in form controls.
