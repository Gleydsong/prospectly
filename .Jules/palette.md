## 2025-01-20 - Form Error Accessibility
**Learning:** Some form controls (like Select and Textarea) in this app's components were lacking explicit ARIA linkage (`aria-describedby`) to their inline error messages, making it harder for screen reader users to understand validation failures.
**Action:** Always ensure inline error messages are explicitly linked to their respective form controls (Input, Select, Textarea) using the `aria-describedby` attribute pointing to a matching `id` on the error text element.
