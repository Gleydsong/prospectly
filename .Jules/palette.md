## 2024-05-27 - Inline Error Message Accessibility Linkage

**Learning:** When reviewing form components, we noticed that while the `Input` component properly linked its inline error message using `aria-describedby` (pointing to a specific `id` on the error text), other form components like `Select` and `Textarea` lacked this explicit linkage. This discrepancy creates an inconsistent accessibility experience for screen reader users trying to understand validation errors across different field types.

**Action:** Ensure all form controls (Input, Select, Textarea, etc.) uniformly apply `aria-describedby` when an error is present, linking to an error element with a matching `id`. This pattern must be standard across the design system components.
