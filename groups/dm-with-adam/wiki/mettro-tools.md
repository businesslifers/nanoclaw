# Mettro Production Tools

Last updated: 2026-04-23

Tools used internally by the Mettro team and contractors for production work. Separate from the AI/automation stack (NanoClaw, LaunchMate, etc.).

## Media Mate

AI image generation tool used by the design team. Key capabilities:

- Generate hero images, blog images, social assets
- **Can ingest a blog post URL** — Media Mate can read the post and generate contextually relevant images from it. This is the preferred approach for blog hero images as it reduces back-and-forth.
- Designer can share a collection directly with Raels inside Media Mate for review
- Images should NOT look like stock images or clipart — aim for modern, editorial, interest-driven style

### Blog hero image workflow (Luis)

1. Luis generates 3–4 sample images in Media Mate first (review batch)
2. Raels reviews and approves style and quality
3. Subsequent batches of 5–10 after approval
4. Naming convention: `blog-[topic-slug]-hero` (e.g. `blog-website-design-trends-hero`) — optimised for searchability
5. Once approved, images are downloaded and pushed to Squishmate with metadata/context
6. For images going to new website, Luis handles the Squishmate upload (see Squishmate below)

## Squishmate (Squish Mate)

Platform used to manage media/content for the new Mettro website. Images from Media Mate are pushed here with metadata and alt text context.

- There is reportedly a Squishmate SOP somewhere in ClickUp — check before briefing Luis
- Luis to refer to Raels if setup help is needed
- Squishmate replaces manual upload workflows for the new website once live

## Mettro Dev / Staging Site

- **URL:** `mettro-dev.mel.cloudlets.com.au`
- Used for testing new pages, features, and integrations before production go-live
- Janet can browse and analyse pages on this domain (confirmed Apr 27 — Raels asked Janet to check FAQ schema on a dev page)
- **Do not deploy tracking tags to staging** — this was the cause of a past reporting issue (Google tag firing on staging, polluting client reports)

## GreyboxPro

Mettro's proprietary website platform. One of three build options offered to clients (alongside WordPress and custom builds). Used for projects where a Mettro-managed platform is appropriate. Confirmed Apr 30 during website copy session.

## Figma

Design tool for UI/website work. **Not for print** — see CLAUDE.md standing rule on print-ready artwork.

- Luis uses Figma for the Mettro website redesign
- Hero image dimensions/specs come from the Figma file — Luis should know them; do not ask Raels for the spec

## See also

- [team.md](team.md) — Luis and Archie profiles
- [mettro-content-team.md](mettro-content-team.md) — content team spec (Luisa, blog workflow)
