## 2024-11-20 - Missing Error Association in Form Controls
**Learning:** Form components like Select and Textarea lacked proper error message association (`aria-describedby`) to screen readers, unlike the Input component.
**Action:** Always ensure that inline error messages in form components are explicitly linked to the input control using the `aria-describedby` attribute, pointing to a matching `id` on the error text element.
