## 2024-09-21 - Form Control Error Accessibility

**Learning:** When creating or modifying form controls (like Input, Select, Textarea, etc.) that display inline error messages, it is critical to explicitly link the error message text to the input control using the `aria-describedby` attribute for screen reader accessibility. Relying solely on proximity or a `role="alert"` on the error text is insufficient for ensuring the user hears the error when focused on the input field.

**Action:** Always ensure that `aria-describedby` is set on the form control pointing to a matching `id` on the error text element.
