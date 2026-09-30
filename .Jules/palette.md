## 2026-09-30 - [Link form errors with aria-describedby]
**Learning:** Found that some form controls (Select, Textarea) had inline error messages that were not programmatically associated with the input element, causing screen readers to miss the context of the error.
**Action:** Always ensure inline error messages are explicitly linked to the control using the `aria-describedby` attribute, pointing to a matching `id` on the error text element, and sanitize `useId()` output by removing colons.
