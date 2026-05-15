---
name: supabase-cli
description: Drive Supabase from the CLI. Use when asked to deploy edge functions, manage Supabase projects, sync secrets, run migrations, or otherwise interact with Supabase from the command line.
---

# Supabase CLI

You can drive Supabase using the `supabase` CLI — deploy edge functions, manage projects, sync secrets, etc.

## Auth

Auth is handled by OneCLI — the HTTPS_PROXY injects the real access token into API requests automatically. The Supabase CLI refuses to call the API unless `SUPABASE_ACCESS_TOKEN` is set in the environment, so **always set `SUPABASE_ACCESS_TOKEN=placeholder`** on every command. OneCLI replaces this with the real token at the proxy level.

Before any Supabase API operation, verify auth:

```bash
SUPABASE_ACCESS_TOKEN=placeholder supabase projects list
```

If this fails with an auth error (`401`, `403`, "invalid token"), ask the user to add a Supabase token to OneCLI. They can create one at https://supabase.com/dashboard/account/tokens and register it via `onecli secrets create` on the host. Once added, retry the call.

## Deploying Edge Functions

The function source must live at `supabase/functions/<name>/index.ts` (Deno-style) inside the project directory you deploy from. The CLI uploads the source — no Docker build, no local runtime required.

```bash
# Deploy a single function
SUPABASE_ACCESS_TOKEN=placeholder supabase functions deploy <function-name> --project-ref <project-ref>

# Deploy from a specific directory (instead of cd-ing)
SUPABASE_ACCESS_TOKEN=placeholder supabase functions deploy <function-name> --project-ref <project-ref> --workdir /path/to/project

# Deploy all functions in the project
SUPABASE_ACCESS_TOKEN=placeholder supabase functions deploy --project-ref <project-ref>

# Deploy without import-map verification (faster, less safe)
SUPABASE_ACCESS_TOKEN=placeholder supabase functions deploy <function-name> --project-ref <project-ref> --no-verify-jwt
```

After deploying, verify the function is live:

```bash
# List deployed functions
SUPABASE_ACCESS_TOKEN=placeholder supabase functions list --project-ref <project-ref>

# Tail logs (Ctrl-C to exit — short bursts only, don't leave it running)
SUPABASE_ACCESS_TOKEN=placeholder supabase functions logs <function-name> --project-ref <project-ref>
```

## Pre-Send Checks (do this before telling the user the deploy is done)

Don't claim a deploy worked until you've actually confirmed it. At minimum:

1. **Source exists** — `ls supabase/functions/<name>/index.ts` succeeds before you invoke deploy. Deploying a missing function silently uploads nothing useful.
2. **CLI reports success** — the `supabase functions deploy` output ends with `Deployed Functions on project ...` and lists the function name. A non-zero exit means it failed.
3. **Function is listed** — `supabase functions list --project-ref <ref>` shows the deployed function with a recent `updated_at`.
4. **Optional smoke test** — if the function has a known invocation path, `curl` it (with the project's anon key in `Authorization: Bearer <anon>`) and check for a sensible response.

If any check fails, fix the issue and redeploy before reporting to the user.

## Project Management

```bash
# List your projects (good first call to verify auth)
SUPABASE_ACCESS_TOKEN=placeholder supabase projects list

# Show one project's details
SUPABASE_ACCESS_TOKEN=placeholder supabase projects api-keys --project-ref <project-ref>
```

## Function Secrets

Edge functions read secrets from the project's secret store, not from your local env.

```bash
# List secrets
SUPABASE_ACCESS_TOKEN=placeholder supabase secrets list --project-ref <project-ref>

# Set a secret (use --env-file for multi-secret bulk loads)
SUPABASE_ACCESS_TOKEN=placeholder supabase secrets set NAME=value --project-ref <project-ref>

# Unset a secret
SUPABASE_ACCESS_TOKEN=placeholder supabase secrets unset NAME --project-ref <project-ref>
```

## Database / Migrations

```bash
# Link a local project dir to a remote (writes .supabase/config.toml)
SUPABASE_ACCESS_TOKEN=placeholder supabase link --project-ref <project-ref>

# Push local migrations to remote
SUPABASE_ACCESS_TOKEN=placeholder supabase db push

# Pull remote schema down to local migrations
SUPABASE_ACCESS_TOKEN=placeholder supabase db pull
```

Note: `supabase db` commands additionally need the database password. The CLI will prompt unless `SUPABASE_DB_PASSWORD` is set — that's a separate credential from the access token and isn't routed through OneCLI today. If you hit this and the user wants to automate it, ask them to add `SUPABASE_DB_PASSWORD` to the agent's env or to use a non-DB-touching command path.

## Common Errors

| Error | Fix |
|-------|-----|
| `Access token not provided. Supply an access token by running supabase login` | You forgot `SUPABASE_ACCESS_TOKEN=placeholder`. Re-run with it set. |
| `401 Unauthorized` or `invalid JWT` | The real token in OneCLI may be expired/revoked. Ask the user to refresh the Supabase access token in OneCLI. |
| `404 Project not found` | Wrong `--project-ref`. Verify with `supabase projects list`. |
| `failed to parse import map` | A function's `import_map.json` is malformed. Open the file and fix the JSON. |
| `ENOTFOUND api.supabase.com` | Network/proxy issue. Check OneCLI proxy connectivity. |
| `Cannot find project ref` (no `--project-ref` given, no link) | Either pass `--project-ref <ref>` explicitly or run `supabase link --project-ref <ref>` once. |

## Best Practices

- Always pass `--project-ref` explicitly on one-off commands — relying on `supabase link` state is fragile across sessions.
- Don't `supabase login` interactively — it writes `~/.supabase/access-token` which OneCLI doesn't manage. Stick with the `SUPABASE_ACCESS_TOKEN=placeholder` pattern.
- Before deploying a function, read its `index.ts` and confirm the entry shape (`Deno.serve(...)` or `export default ...`). A broken function deploys cleanly but errors at invocation.
- For repeated commands against the same project, export it once in the shell: `export SUPABASE_PROJECT_REF=<ref>` and pass `--project-ref "$SUPABASE_PROJECT_REF"`.
