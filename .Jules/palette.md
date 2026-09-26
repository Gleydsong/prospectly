## 2024-05-18 - Missing error associations on inputs
**Learning:** While `Input` component correctly implements `aria-describedby` linking to the inline error message `id`, other form controls like `Textarea` and `Select` lacked this crucial accessibility attribute despite having inline error messages.
**Action:** Always ensure that form controls that have inline error messages use `aria-describedby` matching the `id` of the error text element.
