## 2026-09-27 - Inline Form Error Associations
**Learning:** Some form components (like Input) correctly use `aria-describedby` to link error messages, but others (Select, Textarea) were missing this pattern. This causes screen readers to ignore inline validation errors on those specific fields.
**Action:** Always ensure that inline error messages for ANY form control (Input, Select, Textarea, Checkbox) are explicitly linked using the `aria-describedby` attribute pointing to a matching `id` on the error text element.
