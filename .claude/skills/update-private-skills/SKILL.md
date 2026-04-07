---
name: update-private-skills
description: Check for and apply updates to installed skill branches from private and dedicated remotes (not upstream).
---

# About

Skills are distributed as git branches (`skill/*`). The `/update-skills` command handles upstream skills. This command handles everything else — private skills from your fork and dedicated remotes (e.g. `whatsapp`, `telegram`). Only `skill/*` branches are checked; core channel updates on `main` are handled by `/add-*` skills.

Run `/update-private-skills` in Claude Code.

---

# Goal
Help users update their installed skill branches from target remotes without losing local customizations.

# Operating principles
- Never proceed with a dirty working tree.
- Only offer updates for skills the user has already merged (installed).
- Use git-native operations. Do not manually rewrite files except conflict markers.
- Keep token usage low: rely on `git` commands, only open files with actual conflicts.

# Step 0: Preflight

Run:
- `git status --porcelain`

If output is non-empty:
- Tell the user to commit or stash first, then stop.

Identify target remotes and their URLs in one call:
- `git remote -v`
- Filter out `origin` and `upstream`. The remaining remotes are the targets.

If no target remotes exist:
- Tell the user there are no target remotes configured, and stop.

Fetch all target remotes in parallel:
- Run `git fetch <remote> --prune` for each target remote concurrently (parallel bash calls).

# Step 1: Detect installed skills with available updates

For each target remote, list its skill branches:
- `git branch -r --list '<remote>/skill/*'`

If a remote has no `skill/*` branches, note "no skill branches found" in the output and skip it.

For each `<remote>/skill/<name>` found, check for new commits not yet in HEAD:
- `git log --oneline HEAD..<remote>/skill/<name>`
- If empty, the skill is either fully merged (up to date) or never installed.
- If non-empty, check whether the skill was previously installed: `git merge-base --is-ancestor <remote>/skill/<name>~1 HEAD` — if exit 0, updates are available; otherwise it's not installed.

Build three lists (grouped by remote):
- **Updates available**: installed AND has new commits
- **Up to date**: installed, no new commits
- **Not installed**: never merged

# Step 2: Present results

If no updates available:
- Tell the user all installed skills are up to date. List them grouped by remote.
- Mention uninstalled skills briefly.
- Stop here.

If updates are available:
- Show skills with updates, grouped by remote (include the URL from Step 0):
  ```
  skills (https://github.com/...):
    skill/auto-compact: 3 new commits

  whatsapp (https://github.com/...):
    skill/reactions: 2 new commits
  ```
- Also show skills that are up to date (for context).
- Use AskUserQuestion with `multiSelect: true` to let the user pick which to update.
  - One option per skill, labeled `<remote>/skill/<name>` with commit count.
  - Add an option: "Skip — don't update any skills now"
- If user selects Skip, stop here.

# Step 3: Apply updates

Follow the same merge procedure as `/update-skills` Step 3, substituting `upstream/skill/<name>` with `<remote>/skill/<name>`. Include the remote name when telling the user which skill is being updated.

# Step 4: Validation

Same as `/update-skills` Step 4: run `npm run build` and `npm test` after all merges. Only fix issues clearly caused by the merge.

# Step 5: Summary

Show:
- Skills updated (with remote names)
- Skills skipped or failed (if any)
- New HEAD: `git rev-parse --short HEAD`
- Conflicts resolved (list files)

If the service is running, remind the user to restart it.
