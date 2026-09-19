## 2024-05-20 - Ensure form controls link to error messages
**Learning:** Screen readers might not automatically associate an inline error message with its corresponding input field, even if they are visually close to each other. This causes accessibility issues for users relying on screen readers to fill out forms.
**Action:** For all form controls (Select, Textarea, etc.) rendering inline error messages, explicitly link the control to the error text using the `aria-describedby` attribute pointing to a matching `id` on the error text element.
