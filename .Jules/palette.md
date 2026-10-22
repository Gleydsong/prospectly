## 2024-05-18 - Form controls inline error message association
**Learning:** The inline error messages for Input, Select, and Textarea components are missing `aria-describedby` associations to connect them to their corresponding controls, making it difficult for screen readers to announce the error when the field is focused.
**Action:** Add `aria-describedby` attributes linking the form fields to the IDs of their inline error text.
