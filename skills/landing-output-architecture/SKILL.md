---
name: landing-output-architecture
description: "Select and implement the safest landing-page delivery target: standalone HTML/CSS, trusted React with shadcn and GSAP, or Astro with islands. Use when an AI-generated landing needs framework selection, publishing architecture, component boundaries, security constraints, or performance trade-offs."
---

# Landing Output Architecture

Choose the output target before generating code. Do not ask an untrusted model to return executable framework code into a public page.

## Decision rule

| Need | Target |
| --- | --- |
| Tenant-generated page, immediate preview/publish, untrusted content | Sanitized standalone HTML and CSS |
| Reusable product template with rich trusted interactions | React template with shadcn, GSAP, and optional R3F island |
| Marketing site with content-first routes and minimal JavaScript | Astro template with static output and selective islands |

## Current secure path

Generate a full HTML document with inline CSS. Sanitize it, serve it in a sandboxed iframe, and disallow scripts, event handlers, iframes, and arbitrary remote imports. Use progressive CSS motion only. This is the default for Conversion Studio because page content comes from an LLM.

## Trusted-template path

Treat React/Astro source as repository-owned code, never as arbitrary LLM output. Let the LLM select a registered template and provide structured content, design tokens, asset IDs, and motion options. The server validates that data; the build uses only approved components and dependencies.

For React, use shadcn as source-owned accessible primitives, GSAP only inside lifecycle-safe client components, and isolate R3F scenes behind lazy boundaries. For Astro, keep the page static by default and hydrate only the interactive island that needs JavaScript.

Read [references/target-selection.md](references/target-selection.md) before proposing a framework or a migration.
