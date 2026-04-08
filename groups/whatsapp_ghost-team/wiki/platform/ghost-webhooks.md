---
title: Ghost Webhooks
tags: [platform, webhooks, integration, automation]
updated: 2026-04-08
source: https://docs.ghost.org/webhooks
---

# Ghost Webhooks

Webhooks trigger POST requests to a configured URL whenever specific events happen in Ghost. Useful for automations, cache invalidation, notifications, or triggering external workflows.

## Setup

Ghost Admin → Settings → Integrations → Add custom integration → Add webhook

Required fields:
- **Trigger event** — which event to listen for
- **Target URL** — where to POST the payload (must be internet-reachable)

If the endpoint returns a 2xx response, delivery is considered successful. Any other response is a failure. Response bodies are ignored.

## Available Events

### Post Events

| Event | Description |
|-------|-------------|
| `post.added` | Post created (draft) |
| `post.edited` | Post edited |
| `post.deleted` | Post deleted |
| `post.published` | Post published |
| `post.published.edited` | Published post edited |
| `post.unpublished` | Post unpublished |
| `post.scheduled` | Post scheduled |
| `post.unscheduled` | Post unscheduled |
| `post.rescheduled` | Post rescheduled |

### Page Events

| Event | Description |
|-------|-------------|
| `page.added` | Page created |
| `page.edited` | Page edited |
| `page.deleted` | Page deleted |
| `page.published` | Page published |
| `page.published.edited` | Published page edited |
| `page.unpublished` | Page unpublished |
| `page.scheduled` | Page scheduled |
| `page.unscheduled` | Page unscheduled |
| `page.rescheduled` | Page rescheduled |

### Tag Events

| Event | Description |
|-------|-------------|
| `tag.added` | Tag created |
| `tag.edited` | Tag edited |
| `tag.deleted` | Tag deleted |
| `post.tag.attached` | Tag attached to post |
| `post.tag.detached` | Tag detached from post |
| `page.tag.attached` | Tag attached to page |
| `page.tag.detached` | Tag detached from page |

### Member Events

| Event | Description |
|-------|-------------|
| `member.added` | Member joined |
| `member.edited` | Member updated |
| `member.deleted` | Member removed |

### Site Events

| Event | Description |
|-------|-------------|
| `site.changed` | Any content or settings changed |

## Use Cases for Ghost Team

- **Cache invalidation** — trigger a CDN purge when `post.published`
- **Notifications** — Slack alert on new member sign-up
- **Build triggers** — if using a static front-end, rebuild on `site.changed`
- **Automation** — trigger n8n/Make workflows on content events

## Related Pages

- [Ghost CMS Overview](ghost-overview.md)
- [Ghost Content API](ghost-content-api.md)
