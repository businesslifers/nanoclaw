# SOP: Adding Images to the Mettro Blog

## Overview

Every blog post may include up to three image types: a **feature image**, an **internal image**, and an **infographic**. Not every post needs all three. Use the Mettro Image Prompt Builder (HTML tool) to generate prompts, then create images in ChatGPT.

---

## Part 1: Generate the Image Prompt

1. Open `mettro-image-prompt-builder.html` in your browser.
2. Fill in the **Blog** section:
   - **Blog title**: paste the post heading
   - **Audience**: `small business owners` (default for most posts)
   - **URL**: paste the blog post URL (optional for now)
3. Fill in the **Image** section:
   - **Image type**: select Feature image, Internal image, or Infographic
   - **Size**: the tool auto-fills the default for each type (see defaults below); change only if needed
   - **Style**: choose one. Vary styles across posts. If the blog has few photographic images, lean photographic.
   - **Mood**: Professional is a safe default; leave blank if unsure
   - **Colour palette**: choose one, or select Reference image if you have one
4. Add a **reference image URL** (optional but recommended for better results):
   - Search Dribbble or any design site for something that matches the feel
   - Paste the URL into the Reference image URL field
   - **Important: reference images are for style and pattern inspiration only. We do not copy them. Always instruct ChatGPT to use the style only.**
5. Fill in **Main subject**: a brief description of what you want in the image (e.g., "person at a laptop reviewing analytics")
6. Set **Constraints** as needed:
   - Tick **No logos** and **No brand marks** when generating infographics (prevents unwanted Google logos, etc.)
   - Add anything specific in the Other things to avoid field
7. Click **Copy prompt**.

### Default sizes by image type

| Type | Default size |
|---|---|
| Feature image | 16:9 |
| Infographic | 9:16 |
| Internal image | 4:3 |

---

## Part 2: Create the Image in ChatGPT

1. Open ChatGPT and navigate to the **Mettro Blog** project folder.
2. **Start a new conversation** for each image. Using the same conversation causes all images to look identical.
3. Paste the copied prompt.
4. If you have a reference image file (not just a URL), attach it and add: _"Use the style only, do not copy the image."_ This is important — we must not reproduce someone else's work.
5. Review the output:
   - If it looks too cliched or generic, tell ChatGPT: _"This is too cliched. Try again with a more original composition."_
   - If you want to iterate, stay in the same conversation for that image only.
6. Download the final image.

### Tips for better results

- Read the blog briefly before filling in the tool. Even a rough subject idea improves the output.
- If you cannot think of a subject or find a reference, flag it rather than settling for something poor. Some topics are genuinely hard and can be done together.
- Avoid monochromatic for anything representing dynamic business topics; it tends to look flat.

---

## Part 3: Upload to WordPress

1. Open the blog post in WordPress using **normal Edit** (not Edit with Elementor).

### Feature image

2. Locate the **Featured Image** panel in the sidebar.
3. Send the image via Squishmate (set up to push directly to WordPress), or upload manually.
4. Set the uploaded image as the Featured Image.

### Internal image or infographic

5. In the post body, place your cursor where the image should appear and click **Add block > Image**.
6. Upload or select the image.
7. **Turn off the caption** (click the caption toggle; captions are never used).
8. Set the width:
   - **Feature image / internal image (wide)**: set alignment to **Extra Large Offset**
   - **Tall infographic**: leave on **Default** (keeps it within the text column)
9. Open **GBP Classes** and set spacing to **Padding Extra Small** (controls top and bottom spacing).
10. Save or update the post.

### Keeping images consistent within a post

- Feature image and internal image should feel like a set (same style or colour palette).
- Infographics can differ slightly in style but should not feel completely unrelated.
- It is fine for different posts to have very different looks from each other.

---

## Quick Reference

| Step | Action |
|---|---|
| 1 | Open prompt builder, fill in blog title + image settings |
| 2 | Copy prompt |
| 3 | Start new ChatGPT conversation in Mettro Blog folder |
| 4 | Paste prompt (attach reference image file if using one) |
| 5 | Download approved image |
| 6 | In WordPress: set as Featured Image or insert as Image block |
| 7 | Disable caption, set width, apply Padding Extra Small spacing |
