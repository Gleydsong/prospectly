## 2026-09-22 - Form Control Error Messaging Accessibility
**Learning:** While Input components correctly associated inline error messages using `aria-describedby`, other form controls like Select and Textarea were missing this crucial accessibility binding.
**Action:** Ensure all form controls (Input, Select, Textarea, etc.) uniformly associate inline error messages with the field using `aria-describedby` pointing to the matching error text ID.
