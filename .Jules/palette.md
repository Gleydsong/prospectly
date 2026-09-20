## 2024-05-24 - Form Controls Error Accessibility
**Learning:** The `Input` component properly linked inline error messages to the input field using `aria-describedby` matching the `id` of the error text element. However, `Textarea` and `Select` components in the UI library were missing this critical accessibility link for inline errors, breaking the expected pattern. Screen readers wouldn't announce the error when focusing on these fields.
**Action:** Always verify that *all* form controls (not just text inputs) use `aria-describedby` for inline validation messages.
