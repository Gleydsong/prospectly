## 2024-05-14 - UseId Colon Sanitization in React Forms
**Learning:** React's \`useId()\` generates strings with colons (e.g., \`:r1:\`), which can break `querySelector` and other DOM APIs if used as IDs directly in some libraries, or create styling selector issues.
**Action:** When building custom form components (like \`Input\`, \`Textarea\`, etc.), always sanitize \`useId()\` output by stripping colons (\`useId().replace(/:/g, '')\`). However, do not sanitize user-provided \`id\` or \`name\` props.
