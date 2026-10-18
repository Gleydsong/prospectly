## 2024-05-18 - [Add focus state when removing default outline]
**Learning:** When styling interactive elements like Button with Tailwind CSS and removing default outlines using `focus-visible:outline-none`, keyboard accessibility is severely impacted if an alternative visual focus indicator is not provided.
**Action:** Always provide an alternative indicator like `focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]` when hiding the default outline.
