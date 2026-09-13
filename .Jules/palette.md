## 2026-09-13 - [A11y: Form Control Error Linking]
**Learning:** For accessibility, it's critical to ensure inline error messages are explicitly linked to form controls (like Select, Textarea) using the `aria-describedby` attribute pointing to a matching `id` on the error text element. The Input component already does this, but other inputs were missing it.
**Action:** When creating or modifying form controls, always ensure `aria-describedby` is present and properly linked to error elements.
