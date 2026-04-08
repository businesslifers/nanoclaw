---
name: figma
description: Use Figma MCP tools to extract design context — layouts, styles, components, and design tokens — for implementing designs in code. Available when FIGMA_API_KEY is set.
allowed-tools: mcp__figma__*
---

# Figma Design Context

You have access to Figma MCP tools for reading design files. Use these to extract layout, styling, components, and design tokens when implementing designs.

## Available Tools

- `get_design_context` — Extract design info as code-ready context (React + Tailwind by default, but adapt to the target framework). Pass a Figma file/node URL.
- `get_metadata` — Get sparse XML with layer properties, IDs, names, positions, and sizes. Useful for understanding structure before extracting details.
- `get_variable_defs` — Retrieve design tokens: colors, spacing, typography, and other variables defined in the file.
- `get_screenshot` — Capture a visual screenshot of a design node. Useful for verifying your understanding of the design.

## Workflow

1. When given a Figma link, start with `get_metadata` to understand the structure
2. Use `get_design_context` on specific nodes to get implementation-ready details
3. Use `get_variable_defs` to extract design tokens (colors, fonts, spacing)
4. Use `get_screenshot` if you need to visually verify a section

## Tips

- Figma URLs look like `https://www.figma.com/design/<file-key>/...?node-id=<id>`
- You can target specific nodes by including the `node-id` parameter in the URL
- For large files, work node-by-node rather than requesting the entire file
- Design tokens from `get_variable_defs` map to CSS custom properties or theme variables
- When building Ghost themes, map Figma tokens to Handlebars partials and CSS variables
