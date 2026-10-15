## 2025-02-18 - [Fix inline error linking]
**Learning:** When building React form components, safely merge internal ARIA attributes (e.g., `aria-describedby`, `aria-invalid`) with those provided via props, and apply them explicitly *after* spreading `{...props}` to prevent them from being inadvertently overwritten.
**Action:** When creating or modifying form controls, always ensure inline error messages are explicitly linked to the control using `aria-describedby` pointing to a matching `id` on the error text element, and safely merge the attributes.
