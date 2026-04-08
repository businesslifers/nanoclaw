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

## Workflow

1. When given a Figma link like `https://www.figma.com/design/<fileKey>/...?node-id=<nodeId>`:
   - Extract the `fileKey` and `nodeId` from the URL
   - Call `get_figma_data` with those values to get the layout tree
2. Analyze the returned layout data for structure, styles, colors, typography, spacing
3. Use `download_figma_images` to export specific image/icon nodes as SVG or PNG

## Tips

- Figma URLs: `https://www.figma.com/design/<fileKey>/...?node-id=<nodeId>`
- The `nodeId` in URLs uses `-` as separator (e.g., `1-234`) but the API uses `:` (e.g., `1:234`) — convert accordingly
- For large files, always specify a `nodeId` to avoid fetching the entire file tree
- When building Ghost themes, map Figma layout data to Handlebars partials and CSS variables
