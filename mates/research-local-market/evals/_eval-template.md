---
title:
mate:
schema_version: 1
last_reviewed: YYYY-MM-DD
---

# {Eval task title}

## Task

The prompt or task to give the mate. Be specific enough that the same input produces comparable outputs across runs.

## Conditions to compare

Run the task under some combination of:

1. Baseline model (no mate context)
2. Mate prompt only (no wiki, no references)
3. Mate prompt + wiki
4. Mate prompt + wiki + project context

## What good looks like

What a high-quality output for this task contains. Not a rigid rubric — enough to anchor a grader.

## What bad looks like

The failure modes this eval is meant to catch. Generic output, missing rationale, wrong tone, off-spec format, etc.

## Notes

Anything else a future grader needs to know.
