---
name: update-private-skills
description: Check for and apply updates to installed skill branches from the private remote (businesslifers/nanoclaw).
---

# About

Mirror of `/update-skills`, but reads from a private remote instead of upstream. Useful when your team or org maintains skill branches that aren't (or shouldn't be) public on `qwibitai/nanoclaw`.

The default private remote is `https://github.com/businesslifers/nanoclaw.git`, registered as `private`. Skill branches there follow the same `skill/*` convention as upstream.

Run `/update-private-skills` in Claude Code.

## How it works

**Preflight**: checks for clean working tree and the `private` remote.

**Detection**: fetches `private`, lists all `private/skill/*` branches, determines which ones you've previously merged (via merge-base), and checks if any have new commits.

**Selection**: presents a list of skills with available updates. You pick which to update.

**Update**: merges each selected skill branch, resolves conflicts if any, then validates with build + test.

---

# Goal
Help users update their installed skill branches from a private remote without losing local customizations.

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

Check remotes:
- `git remote -v`

If `private` is missing:
- Ask the user for the private repo URL (default: `https://github.com/businesslifers/nanoclaw.git`).
- `git remote add private <url>`

Fetch:
- `git fetch private --prune`

# Step 1: Detect installed skills with available updates

List all private skill branches:
- `git branch -r --list 'private/skill/*'`

For each `private/skill/<name>`:
1. Check if the user has merged this skill branch before. Simplest reliable check: compare `git merge-base HEAD private/skill/<name>` with `git merge-base HEAD private/main` (or `upstream/main` if `upstream` is configured). If the skill merge-base is strictly ahead of (or different from) the main merge-base, the user has merged this skill.
2. Check if there are new commits on the skill branch not yet in HEAD:
   - `git log --oneline HEAD..private/skill/<name>`
   - If this produces output, there are updates available.

Build three lists:
- **Updates available**: skills that are merged AND have new commits
- **Up to date**: skills that are merged and have no new commits
- **Not installed**: skills that have never been merged

# Step 2: Present results

If no skills have updates available:
- Tell the user all installed private skills are up to date. List them.
- If there are uninstalled private skills, mention them briefly (e.g., "5 other private skills available that you haven't installed").
- Stop here.

If updates are available:
- Show the list of skills with updates, including the number of new commits for each:
  ```
  skill/<name>: 3 new commits
  skill/<other>: 1 new commit
  ```
- Also show skills that are up to date (for context).
- Use AskUserQuestion with `multiSelect: true` to let the user pick which skills to update.
  - One option per skill with updates, labeled with the skill name and commit count.
  - Add an option: "Skip — don't update any skills now"
- If user selects Skip, stop here.

# Step 3: Apply updates

For each selected skill (process one at a time):

1. Tell the user which skill is being updated.
2. Run: `git merge private/skill/<name> --no-edit`
3. If the merge is clean, move to the next skill.
4. If conflicts occur:
   - Run `git status` to identify conflicted files.
   - For each conflicted file:
     - Open the file.
     - Resolve only conflict markers.
     - Preserve intentional local customizations.
     - `git add <file>`
   - Complete the merge: `git commit --no-edit`

If a merge fails badly (e.g., cannot resolve conflicts):
- `git merge --abort`
- Tell the user this skill could not be auto-updated and they should resolve it manually.
- Continue with the remaining skills.

# Step 4: Validation

After all selected skills are merged:
- `pnpm run build`
- `pnpm test` (do not fail the flow if tests are not configured)

If build fails:
- Show the error.
- Only fix issues clearly caused by the merge (missing imports, type mismatches).
- Do not refactor unrelated code.
- If unclear, ask the user.

# Step 5: Summary

Show:
- Skills updated (list)
- Skills skipped or failed (if any)
- New HEAD: `git rev-parse --short HEAD`
- Any conflicts that were resolved (list files)

If the service is running, remind the user to restart it to pick up changes.
