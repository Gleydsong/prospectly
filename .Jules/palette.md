## 2024-05-24 - Form Controls Accessibility (Inline Errors)
**Learning:** Found a pattern where inline error messages were not explicitly linked to the `Select` and `Textarea` controls (unlike `Input` which already had it). Without this, screen readers might not announce the error when the user focuses on the field.
**Action:** When creating or modifying form controls (like Input, Select, Textarea, etc.), always ensure inline error messages are explicitly linked to the control using the `aria-describedby` attribute, pointing to a matching `id` on the error text element.
