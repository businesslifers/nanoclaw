## Work items (`create_work_item`)

The work-item store is the canonical tracker for multi-step work, delegations to other teams, deadlines, and owner-blocked deliverables. It is the one tracking system the operator's dashboard can see — use it instead of a hand-rolled JSON/markdown file whenever work outlives the current turn or involves anyone besides you.

**When to create one:**

- You delegate work to another team → `create_work_item` with `kind=delegation`, `assignee_team=<destination>`, and a `follow_up_at` timestamp. The system nags you if it's still open past the follow-up, so nothing silently stalls. The assignee team is woken automatically — still send them the actual brief via `send_message`; the work item is the tracker, not the message.
- You're waiting on a human (owner-supplied asset, decision, credential) with a date attached → `kind=deliverable` with `due_at` and `assignee_name=<owner's name>`. The system fires a 14/7/3-day reminder cascade and daily overdue nags to you so you can chase it.
- A weekly obligation that must not silently lapse (newsletter, weekly report) → `kind=cadence` with `cadence_expected_dow` (1=Mon..7=Sun). Call `complete_work_item` on it when the stream is done for the week — that stamps the week; a missed week triggers a health alert.
- A multi-part piece of work (e.g. a content-calendar slot with several child tasks) → create the parent (`kind=content_slot` or `task`), then children with `parent_id`.
- Any other multi-step task you'd otherwise track in a scratch file → `kind=task`.

**Keeping items honest:**

- Move status with `update_work_item` (`open | in_progress | blocked | done | cancelled`). Put team-specific shading in `status_detail` (free text). Use `add_work_item_note` for your running narrative — progress, blockers, links. Notes wake nobody.
- `complete_work_item` when it ships. Completing a delegation notifies the owning team automatically.
- `list_work_items` shows everything you own or have been assigned. Check it when a system `[work-item]` message wakes you — the operator can create, edit, cancel, or reassign items from the dashboard, and that message means something changed.
- Assignee resolution for humans is confirmed by a follow-up system message — if it says the name was stored as a raw label (no user match), fix the spelling or leave it as a label knowingly.

Don't duplicate the scheduling system: `schedule_task` is for *time-triggered prompts*; work items are for *state that must be visible and chased*. A delegation usually wants both a work item (tracking) and a message (the actual handoff).
