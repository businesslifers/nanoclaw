# Upstream bug report draft — vercel/chat

**Repo:** https://github.com/vercel/chat
**Local mitigation:** `patches/@chat-adapter__slack@4.27.0.patch` (pnpm patch). Drop this patch once the upstream fix is released.
**Status:** NOT yet filed (drafted 2026-06-03). File under a maintainer's GitHub account when ready.

---

**Title:** `@chat-adapter/slack`: section blocks exceeding 3000 chars cause `invalid_blocks`, dropping the entire message

**Body:**

**Package:** `@chat-adapter/slack` (reproduced through latest `4.30.0`)

**Problem:** `cardToBlockKit` / `convertTextToBlock` wrap card text into Slack `section` blocks with no length cap. Slack enforces a hard **3000-character limit per section block's `text.text`**. When a card has any section over that limit, `chat.postMessage` rejects the *entire* message with `invalid_blocks`:

```
must be less than 3001 characters [json-pointer:/blocks/0/text/text]
failed to match all allowed schemas [json-pointer:/blocks/0/text]
```

So the user receives nothing — the message fails permanently after retries.

**Repro:** Send a message whose rendered card produces a section >3000 chars (e.g. a long structured reply with `---` dividers between long paragraphs). `chat.postMessage` returns `invalid_blocks`.

**Expected:** Oversized section text should be split across multiple section blocks (Slack allows up to 50 blocks/message), so long messages deliver intact.

**Suggested fix:** Post-process the assembled blocks in `cardToBlockKit` — for any `section` (and `context` element) whose mrkdwn text exceeds 3000 chars, split at newline/word boundaries into multiple blocks (~2900-char chunks for headroom), guarding the 50-block ceiling. The same bound applies to `header` `plain_text` (150-char limit). Happy to send a PR.

**Reference implementation** (what the local pnpm patch does):

```js
function chunkMrkdwnText(text, max) {
  const chunks = [];
  let remaining = String(text);
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max * 0.5) {
      const space = remaining.lastIndexOf(" ", max);
      cut = space > max * 0.5 ? space : max;
    }
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^[\n ]+/, "");
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
// In cardToBlockKit: return splitOversizedSectionBlocks(blocks)
// — splits oversized section/context text via chunkMrkdwnText(text, 2900),
//   truncates header plain_text to 150, caps total blocks at 50.
```
