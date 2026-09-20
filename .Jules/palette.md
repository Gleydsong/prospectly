## 2024-09-16 - Inline Error Accessibility Linkage
**Learning:** Found that while the Input component correctly uses aria-describedby to link errors to the input control, Select and Textarea components in this design system were missing this critical accessibility feature.
**Action:** Always ensure that form controls that can display an inline error message are explicitly linked to the error text using the `aria-describedby` attribute pointing to a matching `id`.
