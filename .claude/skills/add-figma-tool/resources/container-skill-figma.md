---
name: figma
description: Use Figma MCP tools to extract design context — layouts, styles, components, and design tokens — for implementing designs in code. Available when FIGMA_API_KEY is set.
allowed-tools: mcp__figma__*
---

# Figma Design Context

You have access to Figma MCP tools for reading design files. Use these to extract layout, styling, components, and design tokens when implementing designs.

## Available Tools

- `get_figma_data` — Extract layout information from a Figma file or node. Pass the `fileKey` (from the URL) and optionally a `nodeId` to target a specific frame/component. Use `depth` only if explicitly asked.
- `download_figma_images` — Download SVG and PNG images from Figma nodes. Requires `fileKey`, an array of `nodes` (with `nodeId` and `fileName`), and a `localPath` for saving.

## Required Workflow

Follow this sequence every time you implement from a Figma design:

1. **Fetch design context first.** Call `get_figma_data` with the `fileKey` and `nodeId` to get the structured layout tree for the exact node(s) being implemented.
2. **Narrow large responses.** If the response is too large, re-fetch with a specific `nodeId` targeting just the frame or component you need.
3. **Download assets.** Use `download_figma_images` to export image and icon nodes as SVG or PNG. If the response includes a localhost source for an image or SVG, use that source directly. Do NOT import or add new icon packages — all assets come from the Figma payload.
4. **Translate to project conventions.** The design data represents layout intent, not final code style. Replace generic styling with the project's design system tokens, colour system, typography, and spacing. Reuse existing components rather than duplicating.
5. **Validate.** Strive for 1:1 visual parity with the Figma design. Compare your implementation against the design data for both appearance and behaviour.

## Figma URL Parsing

- URLs look like: `https://www.figma.com/design/<fileKey>/...?node-id=<nodeId>`
- The `nodeId` in URLs uses `-` as separator (e.g., `1-234`) but the API uses `:` (e.g., `1:234`) — convert accordingly
- Always extract and use the `nodeId` when present to avoid fetching the entire file

## Implementation Standards

- Treat Figma MCP output as design representation, not final code
- Apply the project's colour system, typography, and spacing consistently
- Follow established routing, state management, and data-fetch patterns
- Reuse existing components from the target project rather than introducing new ones from the Figma payload

## Prompting Tips

The more specific the user's request, the better your output. When the user gives a Figma link:
- Ask which framework/styling system to target if not obvious from context
- Target exact file paths for where code should be generated
- Modify existing files rather than creating duplicates
- Use the project's preferred layout approach (flexbox, grid, etc.)
