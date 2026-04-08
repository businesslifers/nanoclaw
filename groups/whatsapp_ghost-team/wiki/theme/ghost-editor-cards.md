---
title: Ghost Editor Cards (kg-* classes)
tags: [theme, editor, css, content, cards]
updated: 2026-04-08
source: https://docs.ghost.org/themes/content
---

# Ghost Editor Cards

Ghost's rich editor outputs content using `kg-*` CSS class names. Themes must support these CSS classes for editor content to render correctly. Content is output via the `{{{content}}}` helper.

## Core Figure/Image Structure

Images and embeds are wrapped in `<figure>` and `<figcaption>`:

```html
<figure class="kg-image-card">
  <img class="kg-image" src="..." width="1600" height="2400"
       loading="lazy" srcset="..." sizes="...">
  <figcaption>Caption text</figcaption>
</figure>
```

Key classes:
- `.kg-image-card` — `<figure>` wrapper for image cards
- `.kg-image` — the `<img>` element
- `.kg-embed-card` — `<figure>` wrapper for embed cards

## Image Width Options

Authors can set three image widths. Ghost adds CSS classes:

| Width option | CSS class | Notes |
|-------------|-----------|-------|
| Normal | *(none)* | Default, respects container width |
| Wide | `kg-width-wide` | Extends beyond text column |
| Full width | `kg-width-full` | Full viewport width |

```html
<!-- Wide image -->
<figure class="kg-image-card kg-width-wide">
  <img class="kg-image" ...>
</figure>
```

**Important:** Images include `width` and `height` attributes matching the source image. If your theme sets a `max-width` on images, also set `height: auto` to avoid stretching.

## Editor Card Types

### Gallery Card (`.kg-gallery-card`)

```html
<figure class="kg-gallery-card kg-width-wide">
  <div class="kg-gallery-container">
    <figure class="kg-gallery-image">
      <img ...>
    </figure>
  </div>
</figure>
```

### Bookmark Card (`.kg-bookmark-card`)

Rich link bookmark with title, description, and thumbnail.

```html
<figure class="kg-bookmark-card">
  <a class="kg-bookmark-container" href="...">
    <div class="kg-bookmark-content">
      <div class="kg-bookmark-title">...</div>
      <div class="kg-bookmark-description">...</div>
    </div>
  </a>
</figure>
```

### Embed Card (`.kg-embed-card`)

Embeds (YouTube, Twitter, etc.):

```html
<figure class="kg-embed-card">
  <!-- iframe or embed code -->
</figure>
```

### Callout Card (`.kg-callout-card`)

Highlighted callout block. Variants via background colour:

```html
<div class="kg-callout-card kg-callout-card-green">
  <div class="kg-callout-emoji">💡</div>
  <div class="kg-callout-text">...</div>
</div>
```

Colour variants: `-grey`, `-white`, `-blue`, `-green`, `-yellow`, `-red`, `-pink`, `-purple`

### Toggle Card (`.kg-toggle-card`)

Collapsible content block:

```html
<div class="kg-toggle-card">
  <div class="kg-toggle-heading">
    <h4 class="kg-toggle-heading-text">Heading</h4>
    <button class="kg-toggle-card-icon">...</button>
  </div>
  <div class="kg-toggle-content">...</div>
</div>
```

### Button Card (`.kg-button-card`)

```html
<div class="kg-button-card">
  <a href="..." class="kg-btn kg-btn-accent">Button text</a>
</div>
```

### Header Card (`.kg-header-card`)

Full-width header block:

```html
<div class="kg-header-card kg-width-full kg-size-large kg-style-dark">
  <h2 class="kg-header-card-header">...</h2>
  <p class="kg-header-card-subheader">...</p>
</div>
```

### Audio Card (`.kg-audio-card`)

```html
<div class="kg-audio-card">
  <div class="kg-audio-player">...</div>
</div>
```

### Video Card (`.kg-video-card`)

```html
<figure class="kg-video-card">
  <div class="kg-video-container">
    <video ...></video>
  </div>
</figure>
```

### File Upload Card (`.kg-file-card`)

```html
<figure class="kg-file-card">
  <a class="kg-file-card-container" href="...">
    <div class="kg-file-card-contents">
      <div class="kg-file-card-title">...</div>
      <div class="kg-file-card-caption">...</div>
    </div>
  </a>
</figure>
```

### Signup Card (`.kg-signup-card`)

Email capture card embedded in content:

```html
<div class="kg-signup-card">
  <form class="kg-signup-card-form">
    ...
  </form>
</div>
```

## Enabling Card Assets

For card CSS and JS to load, `card_assets` must be enabled in `package.json`:

```json
{
  "config": {
    "card_assets": true
  }
}
```

Ghost automatically includes its card CSS and JS when this is enabled. Without it, card-specific styling (gallery layouts, toggle behaviour, audio player, etc.) won't work.

## Responsive Images in Content

Ghost automatically generates srcsets for images. The sizes attribute is generated based on `image_sizes` in `package.json`. The `loading="lazy"` attribute is added automatically.

## Related Pages

- [Ghost Theme Structure](ghost-theme-structure.md) — template hierarchy and package.json
- [Component Library](component-library.md) — our CSS conventions for these cards
