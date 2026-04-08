---
title: Ghost Routing (routes.yaml)
tags: [theme, routing, urls, collections, structure]
updated: 2026-04-08
source: https://docs.ghost.org/themes/routing
---

# Ghost Routing

Ghost's URL structure is controlled by `routes.yaml`. It ships with sensible defaults but can be customised extensively for custom site structures.

## File Location

```
/var/www/launchpointgolf/content/settings/routes.yaml
```

Can also be uploaded/downloaded via Ghost Admin → Settings → Labs.

**After editing manually:** `ghost restart` required. After uploading via Admin: routes update immediately.

## Default Configuration

```yaml
routes:

collections:
  /:
    permalink: /{slug}/
    template: index

taxonomies:
  tag: /tag/{slug}/
  author: /author/{slug}/
```

For most sites, this default is all that's needed.

## YAML Notes

- YAML uses **indentation for structure** — must use exactly 2 spaces (no tabs)
- Incorrect indentation is the most common cause of routes.yaml not working

## Collections

Collections are ordered groups of posts with a shared URL and template.

### Default Collection

```yaml
collections:
  /:
    permalink: /{slug}/
    template: index
```

All posts live at `/{slug}/` and are listed at `/`.

### Custom Homepage

```yaml
routes:
  /: home

collections:
  /blog/:
    permalink: /blog/{slug}/
    template: blog
```

This puts a custom `home.hbs` page at `/` and moves posts to `/blog/`.

### Filtering a Collection

```yaml
collections:
  /podcast/:
    permalink: /podcast/{slug}/
    filter: tag:podcast
    template: podcast
  /:
    permalink: /{slug}/
    template: index
```

Posts tagged `podcast` get their own collection at `/podcast/`.

### Multiple Collections (Blog + Podcast)

```yaml
collections:
  /blog/:
    permalink: /blog/{slug}/
    filter: tag:blog
    template: index
  /podcast/:
    permalink: /podcast/{slug}/
    filter: tag:podcast
    template: podcast
```

## Routes

Custom routes map a URL to a template and optionally load data.

```yaml
routes:
  /about/: about
  /features/:
    template: features
    data: page.features
```

Loading `data: page.features` makes the `features` page's content available in the template.

### Building Feeds and APIs

Routes can return JSON or RSS:

```yaml
routes:
  /podcast/feed/:
    template: podcast-feed
    content_type: text/xml
```

## Taxonomies

Taxonomies define archive pages for tags and authors.

```yaml
taxonomies:
  tag: /tag/{slug}/
  author: /author/{slug}/
```

### Customising Taxonomies

```yaml
taxonomies:
  tag: /topic/{slug}/
  author: /writer/{slug}/
```

### Removing Taxonomies

```yaml
taxonomies:
```
(empty value removes all taxonomy routes)

## Channels

Channels are filtered views of posts, like a collection but without claiming the post's permalink.

```yaml
routes:
  /golf-tips/:
    controller: channel
    filter: tag:golf-tips
    template: index
```

Posts tagged `golf-tips` appear at `/golf-tips/` but still live at their original `/{slug}/` URL.

### Channels vs Collections

Use a **collection** when:
- You want posts to live at a specific URL prefix (e.g. `/podcast/my-episode/`)
- Posts belong exclusively to one group

Use a **channel** when:
- You want a filtered view of posts without moving their URLs
- Posts can appear in multiple filtered views

## Redirects

```yaml
# In content/settings/redirects.yaml (separate file)
```

Ghost supports YAML and JSON redirect files (uploaded via Admin → Settings → Labs).

```yaml
302:
  /old-url/: /new-url/
  /another-old/: /new-destination/
301:
  /permanent-old/: /permanent-new/
```

## Related Pages

- [Ghost Theme Structure](ghost-theme-structure.md)
- [Component Library](component-library.md) — our current routing setup
