# NanoClaw

Personal Claude assistant. See [README.md](README.md) for philosophy and setup. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture decisions.

> **Instance isolation:** This is the **Derek** instance (`/home/adam/derek/`). Do not write to files outside this directory unless explicitly asked. Other NanoClaw instances on this machine are off-limits.

## Quick Context

Single Node.js process with skill-based channel system. Channels (WhatsApp, Telegram, Slack, Discord, Gmail) are skills that self-register at startup. Messages route to Claude Agent SDK running in containers (Linux VMs). Each group has isolated filesystem and memory.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/registry.ts` | Channel registry (self-registration at startup) |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `src/request-queue.ts` | Inter-group request queue |
| `src/sender-allowlist.ts` | Per-group sender filtering |
| `src/status-tracker.ts` | Emoji status lifecycle tracking |
| `src/container-runtime.ts` | Runtime abstraction (Docker/Apple Container) |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |
| `container/skills/` | Skills loaded inside agent containers (browser, capabilities, pdf-reader, reactions, request-queue, slack-formatting, status) |

## Secrets / Credentials / Proxy (OneCLI)

API keys, secret keys, OAuth tokens, and auth credentials are managed by the OneCLI gateway — which handles secret injection into containers at request time, so no keys or tokens are ever passed to containers directly. Run `onecli --help`.

**NEVER write secrets to git-tracked directories.** This includes API keys, tokens, SSH keys, passwords, and credentials of any kind. There is no automated secret scanner — prevention depends on discipline:

| Secret type | Where it goes | How agents access it |
|-------------|--------------|---------------------|
| API keys, tokens, OAuth secrets | `onecli secrets create` | Injected via OneCLI proxy at request time |
| SSH private keys, key files | `~/nanoclaw-secrets/<group>/` | Mounted read-only into container at `/workspace/extra/<group>/` |
| WordPress/Ghost admin creds | `~/nanoclaw-secrets/<service>/` | Mounted read-only into container |

When a sub-agent (inside a container) needs a new credential, it must request it via the lead agent — never write it to `/workspace/group/` or any path that maps back to `groups/` in the repo.

## Skills

Four types of skills exist in NanoClaw. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full taxonomy and guidelines.

- **Feature skills** — merge a `skill/*` branch to add capabilities (e.g. `/add-telegram`, `/add-slack`)
- **Utility skills** — ship code files alongside SKILL.md (e.g. `/claw`)
- **Operational skills** — instruction-only workflows, always on `main` (e.g. `/setup`, `/debug`)
- **Container skills** — loaded inside agent containers at runtime (`container/skills/`)

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |
| `/update-nanoclaw` | Bring upstream NanoClaw updates into a customized install |
| `/init-onecli` | Install OneCLI Agent Vault and migrate `.env` credentials to it |
| `/qodo-pr-resolver` | Fetch and fix Qodo PR review issues interactively or in batch |
| `/get-qodo-rules` | Load org- and repo-level coding rules from Qodo before code tasks |

## Upstream Integrity

This instance has customizations to upstream NanoClaw files. See [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) for the full registry. After **any** merge from `upstream` or skill branches, run `npx vitest run src/customization-integrity.test.ts` to catch silent regressions. When resolving merge conflicts in upstream files, always preserve both sides' changes.

## Contributing

Before creating a PR, adding a skill, or preparing any contribution, you MUST read [CONTRIBUTING.md](CONTRIBUTING.md). It covers accepted change types, the four skill types and their guidelines, SKILL.md format rules, PR requirements, and the pre-submission checklist (searching for existing PRs/issues, testing, description format).

## Development

Run commands directly—don't tell the user to run them.

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
npm test             # Run tests (vitest)
npm run lint         # ESLint
./container/build.sh # Rebuild agent container
```

Service management:
```bash
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```

## Troubleshooting

**WhatsApp not connecting after upgrade:** WhatsApp is now a separate skill, not bundled in core. Run `/add-whatsapp` to install it. Existing auth credentials and groups are preserved.

## Container Build Cache

The container buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder then re-run `./container/build.sh`.
