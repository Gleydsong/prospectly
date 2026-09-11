## 2024-03-24 - Missing Form Control Associations
**Learning:** Found an accessibility issue pattern where several custom form controls (`Select`, `Textarea`, `Switch`) were displaying error messages or descriptions visually, but were missing the `aria-describedby` attribute to link these texts programmatically to the inputs. Only the `Input` component had this correctly implemented.
**Action:** Always ensure that any contextual text (errors, hints, descriptions) rendered near a form control is linked to it via `aria-describedby` so screen readers announce it when the control is focused.
