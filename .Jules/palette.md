## 2026-09-15 - Missing error `aria-describedby` association in form controls
**Learning:** Found an accessibility issue pattern where `Textarea` and `Select` components lack `aria-describedby` linking the form element to its respective inline error message, while the `Input` component correctly implements this pattern.
**Action:** When creating or modifying form controls (like Input, Select, Textarea, etc.), always ensure inline error messages are explicitly linked to the control using the `aria-describedby` attribute on the control, pointing to a matching `id` on the error text element.
